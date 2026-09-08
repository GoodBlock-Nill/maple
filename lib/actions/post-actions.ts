'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { isRlsViolation } from '@/lib/actions/pg-error'
import { cooldownMessage, remainingCooldown } from '@/lib/actions/rate-limit'
import { getCurrentUser } from '@/lib/auth/current-user'
import { sanitizePostHtml } from '@/lib/sanitize/post-html'
import { createClient } from '@/lib/supabase/server'
import { suspensionBlockedMessage, suspensionNotice } from '@/lib/utils/suspension'
import { createCommentSchema, createPostSchema } from '@/lib/validation/post'

import type { FormState } from '@/lib/actions/form-state'
import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 커뮤니티 쓰기 서버 액션.
 *
 * 인증은 여기서 다시 확인한다. 프록시의 검사는 낙관적(optimistic)이고, 서버 액션은
 * UI 를 거치지 않는 직접 POST 로도 호출될 수 있기 때문이다. 실제 권한은 RLS 가
 * 최종적으로 강제한다(`posts_insert_community` · `comments_insert_own`).
 *
 * 정지 계정도 같은 두 겹이다. 먼저 여기서 막아 **이유(기간 · 사유)를 알려 주고**,
 * 그래도 뚫린 경우(우리가 읽은 프로필이 낡았다)에는 정책이 42501 로 막는다. 그때도
 * 일반 실패 문구가 아니라 같은 정지 안내로 옮겨 적는다 — 관리자 조치와 사용자가
 * 보는 화면 사이에 틈을 두지 않는다.
 */

const COMMUNITY_PATH = '/community'
const LOGIN_MESSAGE = '로그인 후 이용할 수 있습니다.'
const COMMUNITY_BOARD = 'community'

/** 에디터로 쓴 글은 항상 HTML 로 저장한다. 마크다운은 에디터 도입 전 글에만 남는다. */
const HTML_FORMAT = 'html' as const

/** 사용자의 마지막 작성 시각. 도배 방지 판정에만 쓴다. */
async function getLatestWriteAt(
  supabase: TypedSupabaseClient,
  table: 'posts' | 'comments',
  authorId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from(table)
    .select('created_at')
    .eq('author_id', authorId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.created_at ?? null
}

export async function createPost(_prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser()

  if (user === null) {
    return { formError: LOGIN_MESSAGE }
  }

  const suspended = suspensionNotice(user)

  if (suspended !== null) {
    return { formError: suspended }
  }

  /* 정제를 검증보다 **먼저** 한다. 상한(20,000자)은 실제로 저장되는 문자열을 재야
     의미가 있고, 정제 전 길이는 공격자가 얼마든지 부풀릴 수 있기 때문이다. */
  const parsed = createPostSchema.safeParse({
    category: readField(formData, 'category'),
    title: readField(formData, 'title'),
    content: sanitizePostHtml(readField(formData, 'content')),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const waitSeconds = remainingCooldown(await getLatestWriteAt(supabase, 'posts', user.id))

  if (waitSeconds > 0) {
    return { formError: cooldownMessage(waitSeconds) }
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      board: COMMUNITY_BOARD,
      category_key: parsed.data.category,
      title: parsed.data.title,
      content: parsed.data.content,
      content_format: HTML_FORMAT,
      author_id: user.id,
      /* 작성 시점 닉네임 스냅샷. 탈퇴해도 목록이 깨지지 않도록 비정규화해 둔다. */
      author_name: user.nickname,
    })
    .select('id')
    .single()

  if (error !== null || data === null) {
    if (isRlsViolation(error)) {
      return { formError: suspensionBlockedMessage(user) }
    }

    return { formError: '글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  revalidatePath(COMMUNITY_PATH)

  // redirect() 는 예외를 던지므로 성공 경로의 마지막에서 호출한다.
  redirect(`${COMMUNITY_PATH}/${data.id}`)
}

export async function createComment(_prevState: FormState, formData: FormData): Promise<FormState> {
  const user = await getCurrentUser()

  if (user === null) {
    return { formError: LOGIN_MESSAGE }
  }

  const suspended = suspensionNotice(user)

  if (suspended !== null) {
    return { formError: suspended }
  }

  const parsed = createCommentSchema.safeParse({
    postId: readField(formData, 'postId'),
    content: readField(formData, 'content'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const waitSeconds = remainingCooldown(await getLatestWriteAt(supabase, 'comments', user.id))

  if (waitSeconds > 0) {
    return { formError: cooldownMessage(waitSeconds) }
  }

  const { error } = await supabase.from('comments').insert({
    post_id: parsed.data.postId,
    author_id: user.id,
    author_name: user.nickname,
    content: parsed.data.content,
  })

  if (error !== null) {
    if (isRlsViolation(error)) {
      return { formError: suspensionBlockedMessage(user) }
    }

    return { formError: '댓글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  revalidatePath(`${COMMUNITY_PATH}/${parsed.data.postId}`)

  return { message: '댓글을 등록했습니다.' }
}
