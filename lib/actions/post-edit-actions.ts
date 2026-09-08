'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { isRlsViolation } from '@/lib/actions/pg-error'
import { getCurrentUser } from '@/lib/auth/current-user'
import { sanitizePostHtml } from '@/lib/sanitize/post-html'
import { createClient } from '@/lib/supabase/server'
import { isAuthor } from '@/lib/utils/authorship'
import { suspensionBlockedMessage, suspensionNotice } from '@/lib/utils/suspension'
import { commentIdSchema, postIdSchema, updatePostSchema } from '@/lib/validation/post'

import type { FormState } from '@/lib/actions/form-state'
import type { CurrentUser } from '@/lib/auth/current-user'
import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 작성자 본인의 수정 · 삭제 서버 액션.
 *
 * 소유자 확인을 RLS 에만 맡기지 않고 여기서 한 번 더 한다. 정책만 믿으면 남의
 * 글을 고치려는 요청이 "0건 갱신 + 성공"으로 조용히 끝나서, 사용자에게는 성공한
 * 것처럼 보이고 로그에도 아무 흔적이 남지 않는다.
 *
 * 삭제는 전부 소프트 삭제(`deleted_at`)다. 물리 삭제는 관리자 정책에만 열려 있고,
 * 댓글이 달린 글을 지우면 알림·링크가 통째로 깨진다.
 *
 * 정지 계정은 수정 · 삭제도 막는다. 정지는 "읽기는 되고 쓰기만 막힌다"는 규칙이고
 * (마이그레이션 20260908001700), 글을 고치거나 지우는 것도 쓰기다. 이의 제기 경로는
 * 고객지원 문의로 열려 있다.
 */

const COMMUNITY_PATH = '/community'
const LOGIN_MESSAGE = '로그인 후 이용할 수 있습니다.'
const NOT_FOUND_MESSAGE = '글을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.'
const COMMENT_NOT_FOUND_MESSAGE = '댓글을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.'
const POST_FORBIDDEN_MESSAGE = '본인이 작성한 글만 수정하거나 삭제할 수 있습니다.'
const COMMENT_FORBIDDEN_MESSAGE = '본인이 작성한 댓글만 삭제할 수 있습니다.'
const UPDATE_FAILURE_MESSAGE = '글을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.'
const DELETE_FAILURE_MESSAGE = '글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'
const COMMENT_DELETE_FAILURE_MESSAGE = '댓글을 삭제하지 못했습니다. 잠시 후 다시 시도해 주세요.'

/** 로그인 + 대상 소유권 확인 결과. `state` 가 있으면 그대로 폼에 돌려준다. */
type Guard =
  { ok: true; user: CurrentUser; supabase: TypedSupabaseClient } | { ok: false; state: FormState }

async function requireUser(): Promise<
  { ok: true; user: CurrentUser } | { ok: false; state: FormState }
> {
  const user = await getCurrentUser()

  if (user === null) {
    return { ok: false, state: { formError: LOGIN_MESSAGE } }
  }

  /* 세 액션(수정 · 글 삭제 · 댓글 삭제)이 모두 이 관문을 지난다. 여기 한 곳에서
     막아야 "어떤 버튼은 되고 어떤 버튼은 안 되는" 상태가 생기지 않는다. */
  const suspended = suspensionNotice(user)

  if (suspended !== null) {
    return { ok: false, state: { formError: suspended } }
  }

  return { ok: true, user }
}

/** 삭제되지 않은 커뮤니티 글의 작성자를 확인한다. */
async function requirePostAuthor(id: string): Promise<Guard> {
  const session = await requireUser()

  if (!session.ok) {
    return session
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('posts')
    .select('author_id')
    .eq('id', id)
    .eq('board', 'community')
    .is('deleted_at', null)
    .maybeSingle()

  if (data === null) {
    return { ok: false, state: { formError: NOT_FOUND_MESSAGE } }
  }

  if (!isAuthor(data.author_id, session.user.id)) {
    return { ok: false, state: { formError: POST_FORBIDDEN_MESSAGE } }
  }

  return { ok: true, user: session.user, supabase }
}

async function requireCommentAuthor(id: string): Promise<Guard> {
  const session = await requireUser()

  if (!session.ok) {
    return session
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('comments')
    .select('author_id')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (data === null) {
    return { ok: false, state: { formError: COMMENT_NOT_FOUND_MESSAGE } }
  }

  if (!isAuthor(data.author_id, session.user.id)) {
    return { ok: false, state: { formError: COMMENT_FORBIDDEN_MESSAGE } }
  }

  return { ok: true, user: session.user, supabase }
}

function revalidateDetail(postId: string): void {
  revalidatePath(COMMUNITY_PATH)
  revalidatePath(`${COMMUNITY_PATH}/${postId}`)
}

export async function updatePost(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!postIdSchema.safeParse(id).success) {
    return { formError: NOT_FOUND_MESSAGE }
  }

  const parsed = updatePostSchema.safeParse({
    category: readField(formData, 'category'),
    title: readField(formData, 'title'),
    content: sanitizePostHtml(readField(formData, 'content')),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const guard = await requirePostAuthor(id)

  if (!guard.ok) {
    return guard.state
  }

  /* 시각 컬럼은 보내지 않는다. `set_updated_at` 이 updated_at 을, `mark_post_edited`
     가 edited_at 을 채우고, 클라이언트가 보낸 값은 가드가 되돌린다. */
  const { error } = await guard.supabase
    .from('posts')
    .update({
      category_key: parsed.data.category,
      title: parsed.data.title,
      content: parsed.data.content,
      /* 레거시 마크다운 글도 수정 화면을 거치면 HTML 로 옮겨 적힌다
         (수정 화면이 로드 시점에 변환해 에디터에 넣는다). */
      content_format: 'html',
    })
    .eq('id', id)
    .eq('author_id', guard.user.id)

  if (error !== null) {
    return {
      formError: isRlsViolation(error)
        ? suspensionBlockedMessage(guard.user)
        : UPDATE_FAILURE_MESSAGE,
    }
  }

  revalidateDetail(id)

  // redirect() 는 예외를 던지므로 성공 경로의 마지막에서 호출한다.
  redirect(`${COMMUNITY_PATH}/${id}`)
}

export async function deletePost(id: string, _prevState: FormState): Promise<FormState> {
  if (!postIdSchema.safeParse(id).success) {
    return { formError: NOT_FOUND_MESSAGE }
  }

  const guard = await requirePostAuthor(id)

  if (!guard.ok) {
    return guard.state
  }

  const { error } = await guard.supabase
    .from('posts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('author_id', guard.user.id)

  if (error !== null) {
    return {
      formError: isRlsViolation(error)
        ? suspensionBlockedMessage(guard.user)
        : DELETE_FAILURE_MESSAGE,
    }
  }

  revalidateDetail(id)

  // 삭제한 글의 상세로는 돌아갈 수 없다. 목록에서 1회성 안내를 띄운다.
  redirect(`${COMMUNITY_PATH}?deleted=1`)
}

export async function deleteComment(
  postId: string,
  id: string,
  _prevState: FormState,
): Promise<FormState> {
  if (!postIdSchema.safeParse(postId).success || !commentIdSchema.safeParse(id).success) {
    return { formError: COMMENT_NOT_FOUND_MESSAGE }
  }

  const guard = await requireCommentAuthor(id)

  if (!guard.ok) {
    return guard.state
  }

  const { error } = await guard.supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id)
    .eq('author_id', guard.user.id)

  if (error !== null) {
    return {
      formError: isRlsViolation(error)
        ? suspensionBlockedMessage(guard.user)
        : COMMENT_DELETE_FAILURE_MESSAGE,
    }
  }

  revalidateDetail(postId)

  return { message: '댓글을 삭제했습니다.' }
}
