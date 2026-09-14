import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { InquiryReplySection } from '@/components/support/InquiryReplySection'
import {
  INQUIRY_REPLY_CLOSED_NOTICE,
  INQUIRY_REPLY_TOO_MANY_NOTICE,
  INQUIRY_REPLY_WAITING_NOTICE,
  INQUIRY_USER_REPLY_SUBMIT_LABEL,
} from '@/lib/constants/inquiry-thread'

import type { InquiryReply } from '@/types/domain'

/* 서버 액션은 단위 테스트에서 부를 수 없다(`next/headers` · Supabase). 폼이 열리는
   조건만 보므로 호출을 받아 두기만 한다. */
vi.mock('@/lib/actions/inquiry-reply-actions', () => ({
  replyToInquiry: vi.fn(async () => ({})),
}))

/**
 * 답장 폼의 노출 조건.
 *
 * 폼과 안내는 **같은 하나의 결정**이다(`canUserReply`) — 어느 쪽도 없는 상태가
 * 생기면 사용자는 답장을 못 한 채 이유도 모른다.
 */

const INQUIRY_ID = '33333333-0000-4000-8000-000000000001'

function reply(direction: 'outbound' | 'inbound', createdAt: string, isMine = false): InquiryReply {
  return {
    id: `${direction}-${createdAt}`,
    authorName: isMine ? '모험가' : '운영자',
    content: '내용',
    createdAt,
    direction,
    isMine,
    attachments: [],
  }
}

const OPERATOR_ANSWER = reply('outbound', '2026-09-14T01:00:00.000Z')

function submitButton() {
  return screen.queryByRole('button', { name: INQUIRY_USER_REPLY_SUBMIT_LABEL })
}

describe('InquiryReplySection', () => {
  it('should show the reply form on an in-progress inquiry with an operator answer', () => {
    // Arrange & Act
    render(
      <InquiryReplySection
        inquiryId={INQUIRY_ID}
        replies={[OPERATOR_ANSWER]}
        status="in_progress"
        cancelledAt={null}
      />,
    )

    // Assert
    expect(submitButton()).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: /답장 내용/u })).toBeInTheDocument()
  })

  it('should keep the submit locked until something is typed', async () => {
    // Arrange
    const { default: userEvent } = await import('@testing-library/user-event')
    const user = userEvent.setup()

    render(
      <InquiryReplySection
        inquiryId={INQUIRY_ID}
        replies={[OPERATOR_ANSWER]}
        status="in_progress"
        cancelledAt={null}
      />,
    )

    // Assert — 빈 답장은 운영자가 무슨 말인지 모른 채 다시 묻게 만든다.
    expect(submitButton()).toBeDisabled()

    // Act
    await user.type(screen.getByRole('textbox', { name: /답장 내용/u }), '계정 ID 는 12345 입니다.')

    // Assert
    expect(submitButton()).toBeEnabled()
  })

  it('should replace the form with the completion notice once the inquiry is answered', () => {
    // Arrange & Act
    render(
      <InquiryReplySection
        inquiryId={INQUIRY_ID}
        replies={[OPERATOR_ANSWER]}
        status="answered"
        cancelledAt={null}
      />,
    )

    // Assert
    expect(submitButton()).not.toBeInTheDocument()
    expect(screen.getByText(INQUIRY_REPLY_CLOSED_NOTICE)).toBeInTheDocument()
  })

  it('should ask a pending inquiry to wait for the operator', () => {
    // Arrange & Act
    render(
      <InquiryReplySection
        inquiryId={INQUIRY_ID}
        replies={[]}
        status="pending"
        cancelledAt={null}
      />,
    )

    // Assert
    expect(submitButton()).not.toBeInTheDocument()
    expect(screen.getByText(INQUIRY_REPLY_WAITING_NOTICE)).toBeInTheDocument()
  })

  it('should close the window after three replies and say how many are allowed', () => {
    // Arrange
    const replies = [
      OPERATOR_ANSWER,
      reply('inbound', '2026-09-14T02:00:00.000Z', true),
      reply('inbound', '2026-09-14T03:00:00.000Z', true),
      reply('inbound', '2026-09-14T04:00:00.000Z', true),
    ]

    // Act
    render(
      <InquiryReplySection
        inquiryId={INQUIRY_ID}
        replies={replies}
        status="in_progress"
        cancelledAt={null}
      />,
    )

    // Assert
    expect(submitButton()).not.toBeInTheDocument()
    expect(screen.getByText(INQUIRY_REPLY_TOO_MANY_NOTICE)).toBeInTheDocument()
  })

  it('should add no extra line to a cancelled inquiry', () => {
    // Arrange & Act — 스레드 자리가 이미 "접수가 취소된 문의입니다"다.
    render(
      <InquiryReplySection
        inquiryId={INQUIRY_ID}
        replies={[]}
        status="closed"
        cancelledAt="2026-09-14T05:00:00.000Z"
      />,
    )

    // Assert
    expect(submitButton()).not.toBeInTheDocument()
    expect(screen.getByText('접수가 취소된 문의입니다.')).toBeInTheDocument()
    expect(screen.queryByText(INQUIRY_REPLY_CLOSED_NOTICE)).not.toBeInTheDocument()
  })
})
