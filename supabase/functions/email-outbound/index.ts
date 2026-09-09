/**
 * email-outbound — 관리자 콘솔의 답신을 이메일로 발송한다.
 *
 * 관리자 서버 액션이 **운영자의 JWT** 로 호출한다(`Authorization: Bearer <access_token>`).
 * 제공자 API 키는 이 함수의 secret 에만 있다 — 관리자 앱은 어떤 발송 비밀도 들고 있지 않다.
 *
 * 인가: 토큰을 anon 클라이언트로 검증(`auth.getUser`)하고 `profiles.role = 'admin'` 을 본다.
 * 모듈 단위(inquiries:write)는 관리자 액션이 이미 판정했다(DEVELOPER-GUIDE §3.3 — RLS 처럼
 * 여기서도 "관리자인가"까지만 본다).
 *
 * 요청  POST { replyId }
 * 응답  200 { ok, status: 'sent', messageId } · 400 invalid_request/not_email_inquiry/not_outbound/no_recipient
 *       401 unauthorized · 403 forbidden · 404 not_found · 409 already_sent · 502 send_failed
 *       503 not_configured (RESEND_API_KEY 또는 EMAIL_FROM 미설정)
 */

import { createResendProvider } from '../_shared/email/resend.ts'
import { replySubject } from '../_shared/email/subject.ts'
import { generateThreadKey, replyAddress } from '../_shared/email/thread.ts'
import { readEmailEnv } from '../_shared/deno/env.ts'
import { createCallerClient, createServiceClient, json } from '../_shared/deno/supabase.ts'

import type { SupabaseClient } from '@supabase/supabase-js'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const SIGNATURE = [
  '',
  '--',
  '글자월드 고객지원',
  '이 메일에 답장하시면 같은 문의에 이어서 접수됩니다.',
].join('\n')

type ReplyRow = {
  id: string
  inquiry_id: string
  content: string
  direction: string
  delivery_status: string | null
}

type InquiryRow = {
  id: string
  source: string
  title: string
  email_from: string | null
  email_message_id: string | null
  email_thread_key: string | null
}

async function requireAdminCaller(
  request: Request,
  service: SupabaseClient,
): Promise<Response | null> {
  const authorization = request.headers.get('Authorization')

  if (authorization === null || !authorization.startsWith('Bearer ')) {
    return json(401, { error: 'unauthorized' })
  }

  const {
    data: { user },
  } = await createCallerClient(authorization).auth.getUser()

  if (user === null) {
    return json(401, { error: 'unauthorized' })
  }

  const { data: profile } = await service
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  return (profile as { role?: string } | null)?.role === 'admin'
    ? null
    : json(403, { error: 'forbidden' })
}

async function readReplyId(request: Request): Promise<string | null> {
  try {
    const body = (await request.json()) as { replyId?: unknown }

    return typeof body.replyId === 'string' && UUID_PATTERN.test(body.replyId) ? body.replyId : null
  } catch {
    return null
  }
}

/** 옛 행에 thread_key 가 없으면 지금 만들어 둔다 — 회신 주소가 없으면 스레딩이 끊긴다. */
async function ensureThreadKey(service: SupabaseClient, inquiry: InquiryRow): Promise<string> {
  if (inquiry.email_thread_key !== null) {
    return inquiry.email_thread_key
  }

  const key = generateThreadKey()

  await service.from('inquiries').update({ email_thread_key: key }).eq('id', inquiry.id)

  return key
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') {
    return json(405, { error: 'method_not_allowed' })
  }

  const service = createServiceClient()
  const denied = await requireAdminCaller(request, service)

  if (denied !== null) {
    return denied
  }

  const replyId = await readReplyId(request)

  if (replyId === null) {
    return json(400, { error: 'invalid_request' })
  }

  const env = readEmailEnv()

  if (env.resendApiKey === null || env.from === null) {
    return json(503, { error: 'not_configured' })
  }

  const { data: replyData } = await service
    .from('inquiry_replies')
    .select('id, inquiry_id, content, direction, delivery_status')
    .eq('id', replyId)
    .maybeSingle()
  const reply = replyData as ReplyRow | null

  if (reply === null) {
    return json(404, { error: 'not_found' })
  }

  const { data: inquiryData } = await service
    .from('inquiries')
    .select('id, source, title, email_from, email_message_id, email_thread_key')
    .eq('id', reply.inquiry_id)
    .maybeSingle()
  const inquiry = inquiryData as InquiryRow | null

  if (inquiry === null) {
    return json(404, { error: 'not_found' })
  }

  if (inquiry.source !== 'email') {
    return json(400, { error: 'not_email_inquiry' })
  }

  if (reply.direction !== 'outbound') {
    return json(400, { error: 'not_outbound' })
  }

  if (reply.delivery_status === 'sent') {
    return json(409, { error: 'already_sent' })
  }

  if (inquiry.email_from === null) {
    return json(400, { error: 'no_recipient' })
  }

  const threadKey = await ensureThreadKey(service, inquiry)
  const provider = createResendProvider(env.resendApiKey)
  const result = await provider.send({
    from: env.from,
    to: inquiry.email_from,
    subject: replySubject(inquiry.title, inquiry.id),
    text: `${reply.content}\n${SIGNATURE}`,
    replyTo: env.replyDomain === null ? null : replyAddress(threadKey, env.replyDomain),
    headers:
      inquiry.email_message_id === null
        ? {}
        : {
            'In-Reply-To': `<${inquiry.email_message_id}>`,
            References: `<${inquiry.email_message_id}>`,
          },
    /* 첫 발송(queued)만 멱등 키를 건다. 실패 뒤의 "다시 보내기"는 사람이 명시적으로 다시
       보내는 것이라 새 요청으로 취급한다. */
    idempotencyKey: reply.delivery_status === 'failed' ? null : `reply-${reply.id}`,
  })

  if (!result.ok) {
    console.error('[email-outbound] 발송 실패', result.status, result.detail)
    await service.from('inquiry_replies').update({ delivery_status: 'failed' }).eq('id', reply.id)

    return json(502, { error: 'send_failed', message: '메일을 보내지 못했습니다.' })
  }

  const { error } = await service
    .from('inquiry_replies')
    .update({
      delivery_status: 'sent',
      email_message_id: result.providerId === '' ? null : result.providerId,
    })
    .eq('id', reply.id)

  if (error !== null) {
    /* 메일은 나갔다. 상태만 못 남긴 것이라 실패로 돌리지 않고 로그로 추적한다. */
    console.error('[email-outbound] 발송 상태 저장 실패', error.message)
  }

  return json(200, { ok: true, status: 'sent', messageId: result.providerId })
})
