import {
  INQUIRY_REPLY_CLOSED_NOTICE,
  INQUIRY_REPLY_ERROR_MESSAGE,
  INQUIRY_REPLY_FAILURE_MESSAGE,
  INQUIRY_REPLY_TOO_MANY_NOTICE,
  INQUIRY_REPLY_WAITING_NOTICE,
  INQUIRY_USER_REPLY_WINDOW,
} from '@/lib/constants/inquiry-thread'
import { isInquiryCancelled } from '@/lib/utils/inquiry-permissions'

import type { InquiryReply, InquiryStatus } from '@/types/domain'

/**
 * 회원 답장 판정 — **화면 분기용**이다.
 *
 * 실제 권한은 `add_inquiry_user_reply()` 가 같은 순서로 다시 본다(마이그레이션
 * 20260914000400 §6). 그런데도 여기서 한 번 더 판정하는 이유는 "폼은 보이는데
 * 보내면 거절되는" 상태를 만들지 않기 위해서다 — 두 곳이 같은 규칙을 쓰도록
 * 순수 함수 하나로 모으고, 그래서 단위 테스트가 붙는다.
 */

/** 답장을 막는 이유. 화면은 이 값으로 안내 한 줄을 고른다. */
export type InquiryReplyBlockedReason =
  'answered' | 'closed' | 'cancelled' | 'pending' | 'no_operator_reply' | 'too_many'

export type InquiryReplyPermission = {
  allowed: boolean
  reason: InquiryReplyBlockedReason | null
}

/** 판정에 필요한 최소 정보. 스레드에서 보는 것은 방향·작성자·시각뿐이다. */
export type InquiryReplySubject = {
  status: InquiryStatus
  cancelledAt: string | null
  replies: readonly Pick<InquiryReply, 'direction' | 'isMine' | 'createdAt'>[]
}

function blocked(reason: InquiryReplyBlockedReason): InquiryReplyPermission {
  return { allowed: false, reason }
}

/** 마지막 운영자 답변 시각. 없으면 null — 아직 대화가 시작되지 않았다. */
function lastOperatorReplyAt(replies: InquiryReplySubject['replies']): string | null {
  return replies
    .filter((reply) => reply.direction === 'outbound')
    .reduce<string | null>(
      (latest, reply) => (latest === null || reply.createdAt > latest ? reply.createdAt : latest),
      null,
    )
}

/**
 * 답장할 수 있는가.
 *
 * 검사 순서가 곧 안내 문구의 우선순위다. 취소가 가장 앞인 이유는 취소한 문의가
 * DB 에 `closed` 로 저장되기 때문이다 — 상태만 보면 "종료"로 읽혀 사용자가 스스로
 * 끝낸 문의에 운영자 안내가 붙는다.
 *
 * 처리 중에서만 열리는 것은 오너 확정 규칙이다(§1). 답변 완료는 재개가 없다.
 */
export function canUserReply({
  status,
  cancelledAt,
  replies,
}: InquiryReplySubject): InquiryReplyPermission {
  if (isInquiryCancelled(cancelledAt)) {
    return blocked('cancelled')
  }

  if (status === 'answered' || status === 'closed') {
    return blocked(status)
  }

  if (status !== 'in_progress') {
    return blocked('pending')
  }

  const operatorAt = lastOperatorReplyAt(replies)

  if (operatorAt === null) {
    return blocked('no_operator_reply')
  }

  /* 마지막 운영자 답변 **이후**의 내 답장만 센다. 운영자가 다시 답하면 창이 새로
     열린다 — 대화는 이어지고, 한 번에 쏟아내는 것만 막는다(RPC 와 같은 셈법). */
  const mine = replies.filter((reply) => reply.isMine && reply.createdAt > operatorAt).length

  if (mine >= INQUIRY_USER_REPLY_WINDOW) {
    return blocked('too_many')
  }

  return { allowed: true, reason: null }
}

/**
 * 막힌 이유의 안내 한 줄.
 *
 * 접수 취소는 `null` 이다 — 스레드 자리에 이미 "접수가 취소된 문의입니다"가 서 있어
 * 같은 말을 두 번 하게 된다(`resolveNoReplyNotice`).
 */
export function userReplyBlockedNotice(reason: InquiryReplyBlockedReason): string | null {
  const notices: Record<InquiryReplyBlockedReason, string | null> = {
    answered: INQUIRY_REPLY_CLOSED_NOTICE,
    closed: INQUIRY_REPLY_CLOSED_NOTICE,
    cancelled: null,
    pending: INQUIRY_REPLY_WAITING_NOTICE,
    no_operator_reply: INQUIRY_REPLY_WAITING_NOTICE,
    too_many: INQUIRY_REPLY_TOO_MANY_NOTICE,
  }

  return notices[reason]
}

/** RPC 실패 코드 → 사용자에게 보여 줄 문구. 모르는 코드는 일반 실패로 둔다. */
export function userReplyErrorMessage(code: string): string {
  return INQUIRY_REPLY_ERROR_MESSAGE[code] ?? INQUIRY_REPLY_FAILURE_MESSAGE
}

export type UserReplyResult = { ok: true; replyId: string | null } | { ok: false; code: string }

/**
 * RPC 의 jsonb 결과를 판별 유니온으로 좁힌다.
 *
 * 타입 생성기는 반환을 `Json` 으로 내보내므로 모양 검사는 런타임이 한다. 알 수 없는
 * 모양은 **실패**로 본다 — 성공으로 오해하면 저장되지 않은 답장을 "보냈습니다" 로
 * 알리고, 사용자는 운영자가 읽지 않을 글을 기다린다.
 */
export function parseUserReplyResult(value: unknown): UserReplyResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, code: 'unknown' }
  }

  const record = value as Record<string, unknown>

  if (record.ok !== true) {
    return { ok: false, code: typeof record.code === 'string' ? record.code : 'unknown' }
  }

  return { ok: true, replyId: typeof record.reply_id === 'string' ? record.reply_id : null }
}
