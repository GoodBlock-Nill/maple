/**
 * email-inbound — 제공자(Resend) 웹훅 수신.
 *
 * 처리 순서(기획서 §5): 서명 검증 → 전달 중복 제거 → 이벤트 분기.
 *   email.received                          → received.ts (정규화 · 루프 방지 · 스레드 · 저장 · 첨부 · 접수 확인)
 *   email.sent/delivered/bounced/failed/… → delivery.ts (발신 답신의 delivery_status 갱신)
 *
 * 응답 규약: 처리했든 무시했든 200. 서명 불일치 401. 설정 누락 503. DB·제공자 오류 5xx —
 * 제공자는 2xx 가 아니면 재시도하므로(5초 · 5분 · 30분 · 2시간 · 5시간 · 10시간) 일시 오류는
 * 5xx 로 돌려 다시 받고, 영구적으로 버릴 것만 200 으로 끝낸다.
 *
 * 배포: `supabase functions deploy email-inbound --no-verify-jwt` — 웹훅은 Supabase JWT 가 없고
 * 대신 Svix 서명으로 인증한다.
 */

import { readSvixHeaders, verifySvixSignature } from '../_shared/email/svix.ts'
import { createResendProvider } from '../_shared/email/resend.ts'
import { readEmailEnv } from '../_shared/deno/env.ts'
import { createServiceClient, isUniqueViolation, json } from '../_shared/deno/supabase.ts'
import { handleDeliveryEvent, isDeliveryEvent } from './delivery.ts'
import { handleReceived } from './received.ts'

import type { InboundContext } from './received.ts'

const RECEIVED_EVENT = 'email.received'

function parseEvent(body: string): { type: string; data: unknown } | null {
  try {
    const parsed = JSON.parse(body) as { type?: unknown; data?: unknown }

    return typeof parsed.type === 'string' ? { type: parsed.type, data: parsed.data ?? {} } : null
  } catch {
    return null
  }
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }

  const svixHeaders = readSvixHeaders(request.headers)

  if (svixHeaders.id === null || svixHeaders.timestamp === null || svixHeaders.signature === null) {
    return json(401, { error: 'missing_signature' })
  }

  const env = readEmailEnv()

  if (env.webhookSecret === null) {
    /* 비밀이 없으면 서명을 검증할 수 없다. "설정 안 됨 = 통과"로 두면 누구나 문의를 꽂아 넣는다. */
    return json(503, { error: 'not_configured' })
  }

  const body = await request.text()
  const verification = await verifySvixSignature({
    secret: env.webhookSecret,
    headers: svixHeaders,
    body,
  })

  if (!verification.ok) {
    console.warn('[email-inbound] 서명 거절', verification.reason)

    return json(401, { error: 'invalid_signature' })
  }

  const event = parseEvent(body)

  if (event === null) {
    return json(400, { error: 'invalid_payload' })
  }

  const service = createServiceClient()
  const deliveryId = svixHeaders.id

  /* 같은 전달(svix-id)의 재시도는 여기서 끝낸다. 제공자는 at-least-once 라 중복이 정상이다. */
  const { error: dedupError } = await service
    .from('email_inbound_events')
    .insert({ id: deliveryId })

  if (isUniqueViolation(dedupError)) {
    return json(200, { ok: true, duplicate: true })
  }

  if (dedupError !== null) {
    console.error('[email-inbound] 전달 기록 실패', dedupError.message)

    return json(500, { error: 'db_error' })
  }

  const context: InboundContext = {
    service,
    env,
    provider: env.resendApiKey === null ? null : createResendProvider(env.resendApiKey),
  }

  try {
    if (event.type === RECEIVED_EVENT) {
      return await handleReceived(context, event.data)
    }

    if (isDeliveryEvent(event.type)) {
      return await handleDeliveryEvent(service, event.type, event.data)
    }

    return json(200, { ok: true, ignored: event.type })
  } catch (error) {
    console.error('[email-inbound] 처리 실패', error instanceof Error ? error.message : error)

    /* 처리 도중 던진 오류는 전달 기록을 지워 재시도가 다시 들어올 수 있게 한다. */
    await service
      .from('email_inbound_events')
      .delete()
      .eq('id', deliveryId ?? '')

    return json(500, { error: 'internal_error' })
  }
})
