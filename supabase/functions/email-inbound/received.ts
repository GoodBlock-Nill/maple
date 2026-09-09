/**
 * `email.received` 처리 — 새 문의 접수 또는 기존 스레드의 inbound 답글.
 *
 * Resend 웹훅은 메타데이터만 주므로(본문·헤더 없음) 제공자 API 로 전체 메일을 받아 합친다.
 * API 키가 없으면 본문을 받을 수 없어 503 을 돌려 제공자가 나중에 다시 보내게 한다.
 */

import { MAX_ATTACHMENTS, buildInquiryContent, markRateLimited } from '../_shared/email/content.ts'
import { checkAutoReply } from '../_shared/email/loop-guard.ts'
import { normalizeInbound, type InboundEmail } from '../_shared/email/normalize.ts'
import { inquiryTitleFromSubject } from '../_shared/email/subject.ts'
import {
  candidateMessageIds,
  extractAddress,
  generateThreadKey,
  parseReplyRecipient,
} from '../_shared/email/thread.ts'
import { isUniqueViolation, json } from '../_shared/deno/supabase.ts'
import { sendAcknowledgement } from './ack.ts'
import { storeAttachments } from './attachments.ts'

import type { EmailEnv } from '../_shared/deno/env.ts'
import type { EmailProvider } from '../_shared/email/resend.ts'
import type { SupabaseClient } from '@supabase/supabase-js'

export type InboundContext = {
  service: SupabaseClient
  provider: EmailProvider | null
  env: EmailEnv
}

/** 같은 발신자 시간당 상한(§5-9). 넘으면 저장은 하되 종료 상태로 접수한다. */
const HOURLY_LIMIT = 20
const ONE_HOUR_MS = 60 * 60 * 1000

type ThreadTarget = {
  id: string
  status: string
  attachments: unknown
}

async function alreadyStored(service: SupabaseClient, messageId: string): Promise<boolean> {
  const [inquiry, reply] = await Promise.all([
    service.from('inquiries').select('id').eq('email_message_id', messageId).maybeSingle(),
    service.from('inquiry_replies').select('id').eq('email_message_id', messageId).maybeSingle(),
  ])

  return inquiry.data !== null || reply.data !== null
}

/** reply+key 수신 주소 → 없으면 In-Reply-To/References 로 우리 발신 메일을 찾는다. */
async function findThread(
  service: SupabaseClient,
  env: EmailEnv,
  email: InboundEmail,
): Promise<ThreadTarget | null> {
  const columns = 'id, status, attachments, source'
  const threadKey = parseReplyRecipient(email.to, env.replyDomain)

  if (threadKey !== null) {
    const { data } = await service
      .from('inquiries')
      .select(columns)
      .eq('email_thread_key', threadKey)
      .maybeSingle()

    if (data !== null) {
      return data as ThreadTarget
    }
  }

  const candidates = candidateMessageIds(email.inReplyTo, email.references)

  if (candidates.length === 0) {
    return null
  }

  const { data: reply } = await service
    .from('inquiry_replies')
    .select('inquiry_id')
    .in('email_message_id', candidates)
    .limit(1)
    .maybeSingle()

  const inquiryId = (reply as { inquiry_id?: string } | null)?.inquiry_id ?? null
  const query = service.from('inquiries').select(columns).eq('source', 'email')
  const { data } = await (inquiryId === null
    ? query.in('email_message_id', candidates).limit(1).maybeSingle()
    : query.eq('id', inquiryId).maybeSingle())

  return (data as ThreadTarget | null) ?? null
}

async function isRateLimited(service: SupabaseClient, emailFrom: string): Promise<boolean> {
  const since = new Date(Date.now() - ONE_HOUR_MS).toISOString()
  const { count } = await service
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('email_from', emailFrom)
    .gte('created_at', since)

  return (count ?? 0) >= HOURLY_LIMIT
}

async function appendInboundReply(
  context: InboundContext,
  email: InboundEmail,
  inquiry: ThreadTarget,
): Promise<Response> {
  const { service, provider } = context
  const existing = Array.isArray(inquiry.attachments) ? inquiry.attachments : []
  const { stored, content } = await storeAttachments(
    service,
    provider,
    email,
    inquiry.id,
    buildInquiryContent(email.text, email.html),
    MAX_ATTACHMENTS - existing.length,
    `r${Date.now().toString(36)}-`,
  )

  const { data: reply, error } = await service
    .from('inquiry_replies')
    .insert({
      inquiry_id: inquiry.id,
      author_id: null,
      author_name: email.from.address,
      content,
      direction: 'inbound',
      email_message_id: email.messageId,
    })
    .select('id')
    .single()

  if (isUniqueViolation(error)) {
    return json(200, { ok: true, duplicate: true })
  }

  if (error !== null) {
    console.error('[email-inbound] inbound 답글 저장 실패', error.message)

    return json(500, { error: 'db_error' })
  }

  /* 답변 완료였다면 운영자가 다시 보게 처리 중으로 되돌린다. 종료는 그대로 둔다(§5-4). */
  const { error: updateError } = await service
    .from('inquiries')
    .update({
      updated_at: new Date().toISOString(),
      ...(inquiry.status === 'answered' ? { status: 'in_progress' } : {}),
      ...(stored.length > 0 ? { attachments: [...existing, ...stored] } : {}),
    })
    .eq('id', inquiry.id)

  if (updateError !== null) {
    console.error('[email-inbound] 문의 갱신 실패', updateError.message)
  }

  return json(200, { ok: true, inquiryId: inquiry.id, replyId: reply.id })
}

async function createInquiry(context: InboundContext, email: InboundEmail): Promise<Response> {
  const { service, provider, env } = context
  const limited = await isRateLimited(service, email.from.address)
  const threadKey = generateThreadKey()
  const title = inquiryTitleFromSubject(email.subject)
  const body = buildInquiryContent(email.text, email.html)

  const { data: inquiry, error } = await service
    .from('inquiries')
    .insert({
      user_id: null,
      source: 'email',
      category: 'email',
      type: 'general',
      title,
      content: limited ? markRateLimited(body) : body,
      contact_email: email.from.address,
      email_from: email.from.address,
      email_from_name: email.from.name,
      email_message_id: email.messageId,
      email_auth: email.auth,
      email_thread_key: threadKey,
      status: limited ? 'closed' : 'pending',
      privacy_consent: false,
      attachments: [],
    })
    .select('id, content')
    .single()

  if (isUniqueViolation(error)) {
    return json(200, { ok: true, duplicate: true })
  }

  if (error !== null) {
    console.error('[email-inbound] 문의 저장 실패', error.message)

    return json(500, { error: 'db_error' })
  }

  if (email.attachments.length > 0) {
    const { stored, content } = await storeAttachments(
      service,
      provider,
      email,
      inquiry.id,
      inquiry.content,
      MAX_ATTACHMENTS,
    )

    if (stored.length > 0 || content !== inquiry.content) {
      await service.from('inquiries').update({ attachments: stored, content }).eq('id', inquiry.id)
    }
  }

  if (!limited) {
    await sendAcknowledgement(service, provider, env, email, { id: inquiry.id, title, threadKey })
  }

  return json(200, { ok: true, inquiryId: inquiry.id, rateLimited: limited })
}

export async function handleReceived(context: InboundContext, data: unknown): Promise<Response> {
  const { service, provider, env } = context
  const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
  const providerEmailId = typeof record.email_id === 'string' ? record.email_id : null
  const hasInlineBody = typeof record.text === 'string' || typeof record.html === 'string'

  let full: unknown = null

  if (!hasInlineBody && providerEmailId !== null) {
    if (provider === null) {
      /* 본문을 받을 수단이 없다. 503 이면 제공자가 재시도하므로 키를 넣은 뒤 다시 들어온다. */
      return json(503, { error: 'not_configured' })
    }

    full = await provider.fetchReceivedEmail(providerEmailId)

    if (full === null) {
      return json(502, { error: 'provider_fetch_failed' })
    }
  }

  const email = normalizeInbound(record, full)

  if (email.from.address === '') {
    return json(200, { ok: true, ignored: 'no_sender' })
  }

  const ownAddress = env.from === null ? null : extractAddress(env.from)
  const guard = checkAutoReply(email, ownAddress === null ? [] : [ownAddress])

  if (guard.blocked) {
    return json(200, { ok: true, ignored: guard.reason })
  }

  if (email.messageId !== null && (await alreadyStored(service, email.messageId))) {
    return json(200, { ok: true, duplicate: true })
  }

  const thread = await findThread(service, env, email)

  return thread === null
    ? createInquiry(context, email)
    : appendInboundReply(context, email, thread)
}
