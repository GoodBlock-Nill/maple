/**
 * 발송 상태 이벤트 → `inquiry_replies.delivery_status`.
 *
 * 이벤트 목록은 https://resend.com/docs/dashboard/webhooks/event-types 에서 확인했다.
 * `data.email_id` 가 발송 API 가 돌려준 id 이고, 우리는 그 값을 outbound 답신의
 * `email_message_id` 에 저장한다(email-outbound). 접수 확인 메일은 답신 행이 없으므로
 * 어느 행에도 맞지 않고 조용히 200 으로 끝난다.
 */

import { json } from '../_shared/deno/supabase.ts'

import type { SupabaseClient } from '@supabase/supabase-js'

/** 이벤트 → 저장 상태. `delivery_delayed` 는 아직 결론이 아니라 건드리지 않는다. */
const EVENT_STATUS: Record<string, 'sent' | 'failed' | null> = {
  'email.sent': 'sent',
  'email.delivered': 'sent',
  'email.delivery_delayed': null,
  'email.bounced': 'failed',
  'email.failed': 'failed',
  'email.complained': 'failed',
  'email.suppressed': 'failed',
}

export function isDeliveryEvent(type: string): boolean {
  return type in EVENT_STATUS
}

export async function handleDeliveryEvent(
  service: SupabaseClient,
  type: string,
  data: unknown,
): Promise<Response> {
  const status = EVENT_STATUS[type] ?? null
  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
  const emailId = typeof record.email_id === 'string' ? record.email_id : null

  if (status === null || emailId === null) {
    return json(200, { ok: true, ignored: type })
  }

  /* 'sent' 가 'delivered' 로 이어지는 것은 같은 값이지만, 'failed' 뒤에 늦게 온 'sent' 가
     실패를 덮어쓰면 운영자가 "다시 보내기"를 놓친다. failed 는 뒤집지 않는다. */
  const query = service
    .from('inquiry_replies')
    .update({ delivery_status: status })
    .eq('email_message_id', emailId)
    .eq('direction', 'outbound')

  const { error } = status === 'sent' ? await query.neq('delivery_status', 'failed') : await query

  if (error !== null) {
    console.error('[email-inbound] 발송 상태 갱신 실패', error.message)

    return json(500, { error: 'db_error' })
  }

  return json(200, { ok: true, event: type, status })
}
