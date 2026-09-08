'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { cooldownMessage, remainingCooldown } from '@/lib/actions/rate-limit'
import { getCurrentUser } from '@/lib/auth/current-user'
import { createClient } from '@/lib/supabase/server'
import { createCommentSchema, createPostSchema } from '@/lib/validation/post'

import type { FormState } from '@/lib/actions/form-state'
import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 커뮤니티 쓰기 서버 액션.
 *
 * 인증은 여기서 다시 확인한다. 프록시의 검사는 낙관적(optimistic)이고, 서버 액션은
 * UI 를 거치지 않는 직접 POST 로도 호출될 수 있기 때문이다. 실제 권한은 RLS 가
 * 최종적으로 강제한다(`posts_insert_community` · `comments_insert_own`).
 */

const COMMUNITY_PATH = '/community'
const LOGIN_MESSAGE = '로그인 후 이용할 수 있습니다.'
const COMMUNITY_BOARD = 'community'

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

  const parsed = createPostSchema.safeParse({
    category: readField(formData, 'category'),
    title: readField(formData, 'title'),
    content: readField(formData, 'content'),
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
      author_id: user.id,
      /* 작성 시점 닉네임 스냅샷. 탈퇴해도 목록이 깨지지 않도록 비정규화해 둔다. */
      author_name: user.nickname,
    })
    .select('id')
    .single()

  if (error !== null || data === null) {
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
    return { formError: '댓글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.' }
  }

  revalidatePath(`${COMMUNITY_PATH}/${parsed.data.postId}`)

  return { message: '댓글을 등록했습니다.' }
}
