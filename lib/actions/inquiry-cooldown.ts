import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 문의 **접수** 도배 판정에 쓰는 "마지막 접수 시각".
 *
 * 판정 자체는 `remainingCooldown`(`lib/actions/rate-limit.ts`)이 하고, 여기서는
 * **무엇을 쓰기로 볼 것인가**만 정한다 — 접수(`inquiries`)뿐이다.
 *
 * 답장(`inquiry_replies`)은 세지 않는다(오너 결정 2026-09-15). 답장은 운영자 답변
 * 하나당 1건이라 1건 규칙(RPC 의 `too_many` · `canUserReply()`)이 이미 연타를 막고,
 * 두 시각을 한 창에 섞으면 "답장했더니 새 문의 접수가 막히는" 경계만 생긴다.
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
