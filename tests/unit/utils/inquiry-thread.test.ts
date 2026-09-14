import { describe, expect, it } from 'vitest'

import {
  INQUIRY_REPLY_CLOSED_NOTICE,
  INQUIRY_REPLY_FAILURE_MESSAGE,
  INQUIRY_REPLY_TOO_MANY_NOTICE,
  INQUIRY_REPLY_WAITING_NOTICE,
} from '@/lib/constants/inquiry-thread'
import {
  canUserReply,
  parseUserReplyResult,
  userReplyBlockedNotice,
  userReplyErrorMessage,
} from '@/lib/utils/inquiry-thread'

import type { InquiryReplySubject } from '@/lib/utils/inquiry-thread'

/**
 * 회원 답장 판정.
 *
 * 같은 규칙을 RPC(`add_inquiry_user_reply`)가 다시 본다. 두 곳이 어긋나면 "폼은
 * 보이는데 보내면 거절되는" 상태가 생기므로, 여기서 검사 순서까지 함께 고정한다.
 */

type Reply = InquiryReplySubject['replies'][number]

function operator(createdAt: string): Reply {
  return { direction: 'outbound', isMine: false, createdAt }
}

function mine(createdAt: string): Reply {
  return { direction: 'inbound', isMine: true, createdAt }
}

const FIRST_ANSWER = '2026-09-14T01:00:00.000Z'

describe('canUserReply', () => {
  it('should open the form on an in-progress inquiry that already has an operator reply', () => {
    // Arrange & Act
    const permission = canUserReply({
      status: 'in_progress',
      cancelledAt: null,
      replies: [operator(FIRST_ANSWER)],
    })

    // Assert
    expect(permission).toEqual({ allowed: true, reason: null })
  })

  it('should block a pending inquiry until the operator answers', () => {
    // Arrange & Act
    const permission = canUserReply({ status: 'pending', cancelledAt: null, replies: [] })

    // Assert
    expect(permission).toEqual({ allowed: false, reason: 'pending' })
  })

  it('should block an in-progress inquiry that has no operator reply yet', () => {
    // Arrange & Act — 처리 중이어도 운영자가 아직 말을 걸지 않았다.
    const permission = canUserReply({
      status: 'in_progress',
      cancelledAt: null,
      replies: [{ direction: 'inbound', isMine: true, createdAt: FIRST_ANSWER }],
    })

    // Assert
    expect(permission).toEqual({ allowed: false, reason: 'no_operator_reply' })
  })

  it('should block answered and closed inquiries because the thread never reopens', () => {
    // Arrange & Act — 오너 확정 규칙(§1): 답변 완료는 재개하지 않는다.
    const answered = canUserReply({
      status: 'answered',
      cancelledAt: null,
      replies: [operator(FIRST_ANSWER)],
    })
    const closed = canUserReply({
      status: 'closed',
      cancelledAt: null,
      replies: [operator(FIRST_ANSWER)],
    })

    // Assert
    expect(answered.reason).toBe('answered')
    expect(closed.reason).toBe('closed')
  })

  it('should report a cancelled inquiry as cancelled, not as closed', () => {
    // Arrange & Act — 취소는 DB 에 closed 로 저장되고 cancelled_at 으로만 구분된다.
    const permission = canUserReply({
      status: 'closed',
      cancelledAt: '2026-09-14T02:00:00.000Z',
      replies: [operator(FIRST_ANSWER)],
    })

    // Assert
    expect(permission).toEqual({ allowed: false, reason: 'cancelled' })
  })

  it('should stop at three replies sent after the last operator answer', () => {
    // Arrange
    const replies = [
      operator(FIRST_ANSWER),
      mine('2026-09-14T02:00:00.000Z'),
      mine('2026-09-14T03:00:00.000Z'),
      mine('2026-09-14T04:00:00.000Z'),
    ]

    // Act
    const permission = canUserReply({ status: 'in_progress', cancelledAt: null, replies })

    // Assert
    expect(permission).toEqual({ allowed: false, reason: 'too_many' })
  })

  it('should open a fresh window once the operator answers again', () => {
    // Arrange — 운영자가 다시 답하면 대화가 이어진다(RPC 와 같은 셈법).
    const replies = [
      operator(FIRST_ANSWER),
      mine('2026-09-14T02:00:00.000Z'),
      mine('2026-09-14T03:00:00.000Z'),
      mine('2026-09-14T04:00:00.000Z'),
      operator('2026-09-14T05:00:00.000Z'),
    ]

    // Act
    const permission = canUserReply({ status: 'in_progress', cancelledAt: null, replies })

    // Assert
    expect(permission.allowed).toBe(true)
  })

  it('should ignore inbound replies that are not mine when counting the window', () => {
    // Arrange — 이메일 인바운드(작성자 없음)는 내 답장이 아니다.
    const replies = [
      operator(FIRST_ANSWER),
      { direction: 'inbound' as const, isMine: false, createdAt: '2026-09-14T02:00:00.000Z' },
      { direction: 'inbound' as const, isMine: false, createdAt: '2026-09-14T03:00:00.000Z' },
      { direction: 'inbound' as const, isMine: false, createdAt: '2026-09-14T04:00:00.000Z' },
    ]

    // Act
    const permission = canUserReply({ status: 'in_progress', cancelledAt: null, replies })

    // Assert
    expect(permission.allowed).toBe(true)
  })
})

describe('userReplyBlockedNotice', () => {
  it('should explain each blocked reason in one line', () => {
    // Arrange & Act & Assert
    expect(userReplyBlockedNotice('answered')).toBe(INQUIRY_REPLY_CLOSED_NOTICE)
    expect(userReplyBlockedNotice('closed')).toBe(INQUIRY_REPLY_CLOSED_NOTICE)
    expect(userReplyBlockedNotice('pending')).toBe(INQUIRY_REPLY_WAITING_NOTICE)
    expect(userReplyBlockedNotice('no_operator_reply')).toBe(INQUIRY_REPLY_WAITING_NOTICE)
    expect(userReplyBlockedNotice('too_many')).toBe(INQUIRY_REPLY_TOO_MANY_NOTICE)
  })

  it('should stay silent on a cancelled inquiry', () => {
    // Arrange & Act & Assert — 스레드 자리가 이미 "접수가 취소된 문의입니다"다.
    expect(userReplyBlockedNotice('cancelled')).toBeNull()
  })
})

describe('userReplyErrorMessage', () => {
  it('should map every RPC failure code to Korean copy', () => {
    // Arrange & Act & Assert — 목록은 함수 주석의 코드 집합과 1:1 이다.
    expect(userReplyErrorMessage('not_owner')).toBe('문의를 찾을 수 없습니다.')
    expect(userReplyErrorMessage('cancelled')).toBe('접수가 취소된 문의에는 답장할 수 없습니다.')
    expect(userReplyErrorMessage('not_in_progress')).toBe(INQUIRY_REPLY_CLOSED_NOTICE)
    expect(userReplyErrorMessage('no_operator_reply')).toBe(INQUIRY_REPLY_WAITING_NOTICE)
    expect(userReplyErrorMessage('too_many')).toBe(INQUIRY_REPLY_TOO_MANY_NOTICE)
    expect(userReplyErrorMessage('invalid')).toContain('답장은 1~2000자')
  })

  it('should fall back to the generic failure for an unknown code', () => {
    // Arrange & Act & Assert
    expect(userReplyErrorMessage('rpc_failed')).toBe(INQUIRY_REPLY_FAILURE_MESSAGE)
  })
})

describe('parseUserReplyResult', () => {
  it('should read the reply id from a successful result', () => {
    // Arrange & Act
    const result = parseUserReplyResult({ ok: true, reply_id: 'r1' })

    // Assert
    expect(result).toEqual({ ok: true, replyId: 'r1' })
  })

  it('should keep the failure code so the form can point at a field', () => {
    // Arrange & Act
    const result = parseUserReplyResult({ ok: false, code: 'too_many' })

    // Assert
    expect(result).toEqual({ ok: false, code: 'too_many' })
  })

  it('should treat an unexpected shape as a failure', () => {
    // Arrange & Act & Assert — 성공으로 오해하면 저장되지 않은 답장을 "보냈습니다"로 알린다.
    expect(parseUserReplyResult(null)).toEqual({ ok: false, code: 'unknown' })
    expect(parseUserReplyResult(['ok'])).toEqual({ ok: false, code: 'unknown' })
    expect(parseUserReplyResult({ ok: false })).toEqual({ ok: false, code: 'unknown' })
  })
})
