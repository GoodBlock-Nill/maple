import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/* 스레드가 이메일 답신 재발송 버튼을 거쳐 서버 액션 모듈을 끌어온다. 렌더에는
   쓰이지 않으므로 `server-only` 가드만 비운다(다른 렌더 테스트와 같은 처리). */
vi.mock('server-only', () => ({}))

import { InquiryMemberReplyBadge } from '@/components/inquiries/InquiryMemberReplyBadge'
import { InquiryReplyFooter } from '@/components/inquiries/InquiryReplyFooter'
import { InquiryReplyThread } from '@/components/inquiries/InquiryReplyThread'

import type { InquiryReplyItem } from '@/lib/data/inquiries'

/**
 * 회원 답장(20260914000400)이 관리자 화면에서 읽히는 방식.
 *
 * 세 자리를 고정한다 — 스레드의 라벨·첨부, 목록의 뱃지, 답변 폼의 안내 문구.
 * 운영자가 "누가 말했는가"를 잘못 읽으면 회원의 문장을 자기 답변으로 오해한 채
 * 대화를 이어간다. 라벨은 색이 아니라 **글자**로 남아야 한다.
 */

const BASE: InquiryReplyItem = {
  id: 'reply-operator',
  authorName: '운영자',
  content: '확인 중입니다.',
  createdAt: '2026-09-14T01:00:00Z',
  direction: 'outbound',
  emailMessageId: null,
  deliveryStatus: null,
  isMemberReply: false,
  attachments: [],
}

const MEMBER_REPLY: InquiryReplyItem = {
  ...BASE,
  id: 'reply-member',
  authorName: '글자용사',
  content: '스크린샷 첨부합니다.',
  createdAt: '2026-09-14T02:00:00Z',
  direction: 'inbound',
  isMemberReply: true,
  attachments: [
    {
      name: 'screenshot.png',
      path: 'user/screenshot.png',
      size: 2048,
      mimeType: 'image/png',
      url: 'https://example.test/signed/screenshot.png',
    },
  ],
}

/** 이메일 인바운드는 `author_id` 가 없다 — 같은 inbound 라도 회원 답장이 아니다. */
const EMAIL_INBOUND: InquiryReplyItem = {
  ...BASE,
  id: 'reply-email',
  authorName: 'user@example.test',
  content: '메일로 보냅니다.',
  direction: 'inbound',
  isMemberReply: false,
}

describe('InquiryReplyThread — 회원 답장', () => {
  it('회원 답장은 라벨과 닉네임으로 운영자 답변과 갈린다', () => {
    // Arrange · Act
    render(<InquiryReplyThread replies={[BASE, MEMBER_REPLY]} isEmail={false} />)

    // Assert
    const memberRow = screen.getByTestId('inquiry-member-reply')

    expect(memberRow).toHaveTextContent('회원 답장')
    expect(memberRow).toHaveTextContent('글자용사')
    expect(screen.getByTestId('inquiry-reply')).not.toHaveTextContent('회원 답장')
  })

  it('제목의 숫자는 운영자 답변만 센다(회원 답장은 설명 줄이 알린다)', () => {
    render(<InquiryReplyThread replies={[BASE, MEMBER_REPLY]} isEmail={false} />)

    expect(screen.getByText('답변 1건')).toBeInTheDocument()
    expect(screen.getByText(/회원 답장 1건이 함께 있습니다/)).toBeInTheDocument()
  })

  it('답장의 첨부를 서명된 주소로 그린다', () => {
    render(<InquiryReplyThread replies={[MEMBER_REPLY]} isEmail={false} />)

    expect(screen.getByAltText('screenshot.png')).toHaveAttribute(
      'src',
      'https://example.test/signed/screenshot.png',
    )
  })

  it('첨부가 없는 답변에는 "첨부파일이 없습니다"를 적지 않는다', () => {
    render(<InquiryReplyThread replies={[BASE]} isEmail={false} />)

    expect(screen.queryByText('첨부파일이 없습니다.')).not.toBeInTheDocument()
  })

  it('이메일 인바운드는 회원 답장이 아니다(받은 메일 그대로)', () => {
    render(<InquiryReplyThread replies={[EMAIL_INBOUND]} isEmail />)

    expect(screen.getByText('받은 메일')).toBeInTheDocument()
    expect(screen.queryByText('회원 답장')).not.toBeInTheDocument()
  })
})

describe('InquiryMemberReplyBadge', () => {
  it('user_replied_at 이 있으면 뱃지를 세운다', () => {
    render(<InquiryMemberReplyBadge userRepliedAt="2026-09-14T02:00:00Z" />)

    expect(screen.getByText('회원 답장')).toBeInTheDocument()
  })

  it('값이 없으면 아무것도 그리지 않는다(운영자가 이미 답했다)', () => {
    const { container } = render(<InquiryMemberReplyBadge userRepliedAt={null} />)

    expect(container).toBeEmptyDOMElement()
  })
})

describe('InquiryReplyFooter — 등록 후 상태 안내', () => {
  it('처리 중과 답변 완료가 대화에 무엇을 하는지 적는다', () => {
    // Arrange · Act
    render(
      <InquiryReplyFooter
        adminNickname="운영자A"
        isPending={false}
        isDisabled={false}
        submitLabel="답변 등록"
        pendingLabel="등록 중…"
      />,
    )

    // Assert — 선택 상자가 그 문장을 자기 설명으로 가리켜야 화면 낭독기도 함께 읽는다.
    const hint = screen.getByText(
      '처리 중: 회원이 이 문의에 답장할 수 있습니다 · 답변 완료: 대화가 닫히며 다시 열 수 없습니다',
    )

    expect(screen.getByLabelText('등록 후 상태')).toHaveAttribute('aria-describedby', hint.id)
  })

  it('기본값은 처리 중이다(오너 규칙 2026-09-14 — 닫는 것은 명시적 선택)', () => {
    render(
      <InquiryReplyFooter
        adminNickname="운영자A"
        isPending={false}
        isDisabled={false}
        submitLabel="답변 등록"
        pendingLabel="등록 중…"
      />,
    )

    expect(screen.getByLabelText('등록 후 상태')).toHaveValue('in_progress')
  })
})
