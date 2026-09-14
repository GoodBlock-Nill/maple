import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { InquiryReplyThread } from '@/components/support/InquiryReplyThread'

import type { InquiryReply } from '@/types/domain'

/**
 * 대화 스레드(2026-09-14).
 *
 * 운영자 답변과 회원 답장이 **한 줄기**로 섞여야 "무엇에 대한 답인지"가 읽힌다.
 * 둘을 가르는 것은 상자 톤과 머리줄 이름이고, 첨부는 각 메시지 아래에 붙는다.
 */

const OPERATOR_REPLY: InquiryReply = {
  id: 'r1',
  authorName: '운영자',
  content: '계정 ID 를 알려 주세요.',
  createdAt: '2026-09-14T01:00:00.000Z',
  direction: 'outbound',
  isMine: false,
  attachments: [],
}

const MY_REPLY: InquiryReply = {
  id: 'r2',
  authorName: '모험가',
  content: '스크린샷 첨부합니다.\n두 번째 줄.',
  createdAt: '2026-09-14T02:00:00.000Z',
  direction: 'inbound',
  isMine: true,
  attachments: [
    {
      name: 'shot.png',
      path: 'uid/shot.png',
      size: 1024,
      mimeType: 'image/png',
      url: 'https://stub.test/sign/shot.png?token=t',
    },
  ],
}

describe('InquiryReplyThread', () => {
  it('should draw the operator answer and my reply in one chronological thread', () => {
    // Arrange & Act
    const { container } = render(
      <InquiryReplyThread
        replies={[OPERATOR_REPLY, MY_REPLY]}
        status="in_progress"
        cancelledAt={null}
      />,
    )

    // Assert — 머리줄 이름으로 화자가 갈린다(내 답장은 닉네임 대신 "내 답변").
    expect(screen.getByText('운영자')).toBeInTheDocument()
    expect(screen.getByText('내 답변')).toBeInTheDocument()
    expect(screen.queryByText('모험가')).not.toBeInTheDocument()
    /* 첨부 목록도 `li` 를 쓰므로 메시지 수는 상자(article)로 센다. */
    expect(container.querySelectorAll('article')).toHaveLength(2)
  })

  it('should tone the two directions differently', () => {
    // Arrange & Act
    const { container } = render(
      <InquiryReplyThread
        replies={[OPERATOR_REPLY, MY_REPLY]}
        status="in_progress"
        cancelledAt={null}
      />,
    )

    // Assert — 운영자는 옅은 파란 면, 내 답장은 흰 면에 테두리(시안 v2 pc-3).
    const boxes = [...container.querySelectorAll('article')]

    expect(boxes[0]?.className).toContain('bg-[#f3f6fe]')
    expect(boxes[1]?.className).toContain('border-[#cdd3db]')
    expect(boxes[1]?.className).toContain('bg-white')
  })

  it('should keep the line breaks of every message', () => {
    // Arrange & Act
    render(<InquiryReplyThread replies={[MY_REPLY]} status="in_progress" cancelledAt={null} />)

    // Assert — 평문이라 줄바꿈만 살린다.
    expect(screen.getByText(/스크린샷 첨부합니다/u).className).toContain('whitespace-pre-line')
  })

  it('should list the attachments of the message they belong to', () => {
    // Arrange & Act
    render(
      <InquiryReplyThread
        replies={[OPERATOR_REPLY, MY_REPLY]}
        status="in_progress"
        cancelledAt={null}
      />,
    )

    // Assert — 서명 URL 링크로 뜬다(비공개 버킷이라 링크가 곧 접근 경로다).
    const link = screen.getByRole('link', { name: /shot\.png/u })

    expect(link).toHaveAttribute('href', 'https://stub.test/sign/shot.png?token=t')
    expect(screen.getAllByText('첨부파일')).toHaveLength(1)
  })

  it('should keep the dashed empty state when nobody has answered yet', () => {
    // Arrange & Act
    render(<InquiryReplyThread replies={[]} status="pending" cancelledAt={null} />)

    // Assert
    const notice = screen.getByText(/운영자가 확인 중입니다/u)

    expect(notice.className).toContain('border-dashed')
  })

  it('should tell a cancelled inquiry apart from a closed one in the empty state', () => {
    // Arrange & Act
    render(
      <InquiryReplyThread replies={[]} status="closed" cancelledAt="2026-09-14T03:00:00.000Z" />,
    )

    // Assert
    expect(screen.getByText('접수가 취소된 문의입니다.')).toBeInTheDocument()
  })
})
