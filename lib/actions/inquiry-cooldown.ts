import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 문의 도배 판정에 쓰는 "마지막 쓰기 시각".
 *
 * 판정 자체는 `remainingCooldown`(`lib/actions/rate-limit.ts`)이 하고, 여기서는
 * **무엇을 쓰기로 볼 것인가**만 정한다. 접수와 답장이 한 창을 나눠 쓰므로 값을
 * 읽는 곳이 하나여야 한다 — 갈라 두면 한쪽만 고쳐져 "접수는 막히는데 답장은 열리는"
 * 경계가 생긴다.
 *
 * `'use server'` 파일이 아니다(서버 액션 파일은 export 가 전부 액션이어야 한다).
 */

/** 사용자의 마지막 접수 시각. 한 건도 없으면 null. */
export async function getLatestInquiryAt(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('inquiries')
    .select('created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.created_at ?? null
}

/** 사용자가 마지막으로 보낸 답장 시각. 이메일 인바운드(작성자 없음)는 세지 않는다. */
async function getLatestUserReplyAt(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('inquiry_replies')
    .select('created_at')
    .eq('author_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.created_at ?? null
}

/**
 * 접수와 답장을 통틀어 마지막으로 글을 남긴 시각.
 *
 * 답장만 보면 "접수하고 곧바로 답장"이 창을 우회하고, 접수만 보면 답장 연타가
 * 열린다. 두 값 중 **나중**을 기준으로 잡아야 어느 경로로도 30초 안에 두 번 쓰지
 * 못한다. ISO 8601(UTC)은 문자열 비교가 곧 시간 비교다.
 */
export async function getLatestInquiryWriteAt(
  supabase: TypedSupabaseClient,
  userId: string,
): Promise<string | null> {
  const [inquiryAt, replyAt] = await Promise.all([
    getLatestInquiryAt(supabase, userId),
    getLatestUserReplyAt(supabase, userId),
  ])

  if (inquiryAt === null || replyAt === null) {
    return inquiryAt ?? replyAt
  }

  return inquiryAt > replyAt ? inquiryAt : replyAt
}
