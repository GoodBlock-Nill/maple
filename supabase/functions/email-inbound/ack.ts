/**
 * 접수 확인 메일(선택, `EMAIL_INQUIRY_ACK=on`).
 *
 * 같은 발신자에게 **24시간에 한 통**만 보낸다(기획서 §5-8) — 상대가 자동응답기라면
 * 확인 메일이 또 자동응답을 부르고, 그 자동응답은 루프 가드가 막지만 첫 한 통은 나간다.
 * 하루 한 통이면 폭탄이 되지 않는다.
 *
 * 개인정보 처리 고지(§8): 이메일 문의는 폼 동의가 없으므로 방침 링크를 여기서 알린다.
 */

import { replySubject } from '../_shared/email/subject.ts'
import { replyAddress } from '../_shared/email/thread.ts'

import type { EmailEnv } from '../_shared/deno/env.ts'
import type { EmailProvider } from '../_shared/email/resend.ts'
import type { InboundEmail } from '../_shared/email/normalize.ts'
import type { SupabaseClient } from '@supabase/supabase-js'

const ONE_DAY_MS = 24 * 60 * 60 * 1000

export function acknowledgementBody(
  inquiryNo: number,
  title: string,
  clientSiteUrl: string,
): string {
  return [
    '안녕하세요, 글자월드 고객지원입니다.',
    '',
    '보내 주신 문의가 접수되었습니다. 확인 후 이 메일에 회신으로 답변드리겠습니다.',
    '덧붙일 내용이 있으면 이 메일에 그대로 답장해 주세요 — 같은 문의로 이어서 접수됩니다.',
    '',
    // 사용자 사이트·관리자 콘솔과 같은 접수번호다(uuid 앞 8자를 쓰던 표기를 대체한다).
    `문의 번호: #${inquiryNo}`,
    `접수 제목: ${title}`,
    '',
    '이메일 문의로 수집되는 개인정보(메일 주소 · 이름 · 본문 · 첨부)의 처리 기준은 개인정보처리방침에서 확인하실 수 있습니다.',
    `${clientSiteUrl}/policy/privacy`,
    '',
    '이 메일은 자동으로 발송되었습니다.',
  ].join('\n')
}

/** 최근 24시간 안에 같은 주소로 접수된 문의가 이번 것뿐인지. */
async function isFirstInquiryToday(
  service: SupabaseClient,
  emailFrom: string,
  inquiryId: string,
): Promise<boolean> {
  const since = new Date(Date.now() - ONE_DAY_MS).toISOString()
  const { count, error } = await service
    .from('inquiries')
    .select('id', { count: 'exact', head: true })
    .eq('email_from', emailFrom)
    .neq('id', inquiryId)
    .gte('created_at', since)

  return error === null && (count ?? 0) === 0
}

export async function sendAcknowledgement(
  service: SupabaseClient,
  provider: EmailProvider | null,
  env: EmailEnv,
  email: InboundEmail,
  inquiry: { id: string; no: number; title: string; threadKey: string },
): Promise<void> {
  if (!env.ackEnabled || provider === null || env.from === null) {
    return
  }

  if (!(await isFirstInquiryToday(service, email.from.address, inquiry.id))) {
    return
  }

  const result = await provider.send({
    from: env.from,
    to: email.from.address,
    subject: replySubject(email.subject, inquiry.no),
    text: acknowledgementBody(inquiry.no, inquiry.title, env.clientSiteUrl),
    replyTo: env.replyDomain === null ? null : replyAddress(inquiry.threadKey, env.replyDomain),
    headers: {
      /* RFC 3834 — 상대의 자동응답기가 이 메일에 다시 자동응답하지 않게 한다. */
      'Auto-Submitted': 'auto-replied',
      ...(email.messageId === null
        ? {}
        : { 'In-Reply-To': `<${email.messageId}>`, References: `<${email.messageId}>` }),
    },
    idempotencyKey: `ack-${inquiry.id}`,
  })

  if (!result.ok) {
    console.error('[email-inbound] 접수 확인 메일 실패', result.status, result.detail)
  }
}
