/**
 * 루프·자동 메일 차단.
 *
 * 우리가 접수 확인 메일을 보내면 상대의 부재중 자동응답이 돌아오고, 그것을 새 문의로
 * 받으면 다시 접수 확인을 보내는 고리가 생긴다. RFC 3834 의 `Auto-Submitted`, 관례적인
 * `Precedence: bulk|junk|list`, `X-Autoreply` 계열, 배달 실패 보고(DSN), 그리고 발신자가
 * 우리 자신인 메일은 저장하지 않는다(200 으로 조용히 끝낸다).
 */

import type { InboundEmail } from './normalize.ts'

export type LoopGuardResult = { blocked: false } | { blocked: true; reason: string }

const BULK_PRECEDENCE = new Set(['bulk', 'junk', 'list', 'auto_reply', 'auto-reply'])

/* 사람이 답할 수 없는 발신 로컬파트. 배달 실패·시스템 알림이 문의 목록을 채우지 않게 한다. */
const SYSTEM_LOCAL_PARTS =
  /^(?:mailer-daemon|postmaster|no-?reply|do-?not-?reply|bounce|bounces)(?:[+@.-]|$)/i

function headerValue(email: InboundEmail, name: string): string {
  return (email.headers[name] ?? '').trim().toLowerCase()
}

export function checkAutoReply(
  email: InboundEmail,
  ownAddresses: readonly string[],
): LoopGuardResult {
  const autoSubmitted = headerValue(email, 'auto-submitted')

  if (autoSubmitted !== '' && autoSubmitted !== 'no') {
    return { blocked: true, reason: `auto-submitted: ${autoSubmitted}` }
  }

  const precedence = headerValue(email, 'precedence')

  if (BULK_PRECEDENCE.has(precedence)) {
    return { blocked: true, reason: `precedence: ${precedence}` }
  }

  if (email.headers['x-autoreply'] !== undefined || email.headers['x-autorespond'] !== undefined) {
    return { blocked: true, reason: 'x-autoreply' }
  }

  /* 뉴스레터·메일링 리스트. 문의가 아니라 광고이고, 답신을 보내면 리스트에 뿌려질 수 있다. */
  if (email.headers['list-id'] !== undefined || email.headers['list-unsubscribe'] !== undefined) {
    return { blocked: true, reason: 'mailing-list' }
  }

  /* 배달 실패 보고(DSN)는 multipart/report 로 온다. */
  if (headerValue(email, 'content-type').startsWith('multipart/report')) {
    return { blocked: true, reason: 'delivery-report' }
  }

  const from = email.from.address.toLowerCase()
  const at = from.indexOf('@')
  const local = at === -1 ? from : from.slice(0, at)

  if (SYSTEM_LOCAL_PARTS.test(local)) {
    return { blocked: true, reason: `system-sender: ${local}` }
  }

  if (ownAddresses.some((own) => own.trim().toLowerCase() === from)) {
    return { blocked: true, reason: 'own-address' }
  }

  return { blocked: false }
}
