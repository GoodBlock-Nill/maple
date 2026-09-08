'use server'

import { revalidatePath } from 'next/cache'

import { isRlsViolation, isUniqueViolation } from '@/lib/actions/pg-error'
import { LIKE_COOLDOWN_SECONDS, remainingCooldown } from '@/lib/actions/rate-limit'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createClient } from '@/lib/supabase/server'
import { toggleLikeState } from '@/lib/utils/like-state'
import { suspensionBlockedMessage, suspensionNotice } from '@/lib/utils/suspension'
import { postIdSchema } from '@/lib/validation/post'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { ToggleLikeResult } from '@/lib/utils/like-state'

/**
 * 좋아요 토글 서버 액션.
 *
 * 상태는 `post_likes` 의 행 존재 여부 하나로 정해진다. `posts.like_count` 는
 * 트리거가 따라오는 파생값이라 여기서 직접 쓰지 않는다(써 봐야
 * `guard_post_counters()` 가 되돌린다).
 *
 * 검사는 세 겹이다.
 *   1) 여기(세션 · 정지 · 대상 존재 · 연타) — 사용자에게 이유를 알려 주기 위해.
 *   2) `post_likes_insert_own` / `post_likes_delete_own` 정책 — 직접 POST 차단.
 *   3) 복합 PK — 더블클릭·동시 요청으로 같은 행이 두 번 들어가는 것을 막는다.
 *
 * 어떤 경로에서도 Supabase 원문 오류를 그대로 돌려주지 않는다.
 */

const COMMUNITY_PATH = '/community'

const LOGIN_MESSAGE = '로그인 후 이용할 수 있습니다.'
const INVALID_MESSAGE = '잘못된 게시글입니다.'
const NOT_FOUND_MESSAGE = '글을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.'
const FAILURE_MESSAGE = '좋아요를 반영하지 못했습니다. 잠시 후 다시 시도해 주세요.'
const COOLDOWN_MESSAGE = '너무 빠르게 누르고 있습니다. 잠시 후 다시 시도해 주세요.'

/** 사용자의 마지막 좋아요 시각. 연타 판정에만 쓴다. */
async function getLatestLikeAt(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('post_likes')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.created_at ?? null
}

/**
 * 반영 후의 집계값.
 *
 * 트리거가 갱신한 뒤의 `posts.like_count` 를 다시 읽는다. 클라이언트에서 +1 한
 * 값을 그대로 확정해 버리면, 그 사이 다른 사람이 누른 만큼 화면이 어긋난 채
 * 굳는다. 못 읽으면 낙관적 값으로 폴백한다(다음 렌더에서 바로잡힌다).
 */
async function readLikeCount(
  supabase: TypedSupabaseClient,
  postId: string,
  fallback: number,
): Promise<number> {
  const { data } = await supabase.from('posts').select('like_count').eq('id', postId).maybeSingle()

  return data?.like_count ?? fallback
}

function failure(formError: string, requiresLogin = false): ToggleLikeResult {
  return { ok: false, requiresLogin, formError }
}

export async function toggleLike(postId: string): Promise<ToggleLikeResult> {
  const user = await getCurrentUser()

  if (user === null) {
    // 버튼은 비로그인에게도 보인다. 클라이언트가 이 신호를 받아 로그인으로 보낸다.
    return failure(LOGIN_MESSAGE, true)
  }

  const suspended = suspensionNotice(user)

  if (suspended !== null) {
    return failure(suspended)
  }

  const parsed = postIdSchema.safeParse(postId)

  if (!parsed.success) {
    return failure(INVALID_MESSAGE)
  }

  const id = parsed.data
  const supabase = await createClient()

  const waitSeconds = remainingCooldown(
    await getLatestLikeAt(supabase, user.id),
    Date.now(),
    LIKE_COOLDOWN_SECONDS,
  )

  if (waitSeconds > 0) {
    return failure(COOLDOWN_MESSAGE)
  }

  /* 조회는 anon/authenticated 정책을 그대로 타므로 비공개·삭제된 글은 여기서
     걸린다. `board` 를 좁히는 이유는 좋아요 UI 와 아래 revalidate 경로가 모두
     커뮤니티 상세뿐이기 때문이다. */
  const { data: post } = await supabase
    .from('posts')
    .select('like_count')
    .eq('id', id)
    .eq('board', 'community')
    .eq('is_published', true)
    .is('deleted_at', null)
    .maybeSingle()

  if (post === null) {
    return failure(NOT_FOUND_MESSAGE)
  }

  const { data: existing } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  const liked = existing !== null
  const { error } = liked
    ? await supabase.from('post_likes').delete().eq('post_id', id).eq('user_id', user.id)
    : await supabase.from('post_likes').insert({ post_id: id, user_id: user.id })

  /* 중복 insert 는 경합의 정상적인 결말이다(다른 탭이 먼저 눌렀다). 이미 눌린
     상태이므로 오류가 아니라 "눌림"으로 확정한다. */
  if (error !== null && !isUniqueViolation(error)) {
    /* 정책이 막았다면(`post_likes_insert_own` 의 `not is_suspended()`) 그 사이
       정지가 걸린 것이다. 일반 실패 문구 대신 같은 정지 안내를 돌려준다. */
    return failure(isRlsViolation(error) ? suspensionBlockedMessage(user) : FAILURE_MESSAGE)
  }

  // 낙관적 UI 와 같은 규칙을 쓴다. 집계를 못 읽었을 때의 폴백값이기도 하다.
  const next = toggleLikeState({ liked, likeCount: post.like_count })

  /* 상세의 메타 줄(좋아요 수)과 목록의 정렬(`sort=likes`)이 둘 다 이 값을 읽는다. */
  revalidatePath(`${COMMUNITY_PATH}/${id}`)
  revalidatePath(COMMUNITY_PATH)

  return {
    ok: true,
    liked: next.liked,
    likeCount: await readLikeCount(supabase, id, next.likeCount),
  }
}
