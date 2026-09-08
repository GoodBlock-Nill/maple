import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InquirySubmittedDialog } from '@/components/support/InquirySubmittedDialog'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

const DETAIL_PATH = '/support/inquiries/33333333-0000-4000-8000-000000000001'

beforeEach(() => {
  replace.mockReset()
})

describe('InquirySubmittedDialog', () => {
  it('should open as a labelled modal with the next steps', () => {
    // Arrange & Act
    render(<InquirySubmittedDialog detailPath={DETAIL_PATH} />)

    // Assert
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('문의가 접수되었습니다')
    expect(screen.getByText(/운영자가 확인 후 답변을 등록하면/)).toBeInTheDocument()
  })

  it('should offer a link to the inquiry list', () => {
    // Arrange & Act
    render(<InquirySubmittedDialog detailPath={DETAIL_PATH} />)

    // Assert
    expect(screen.getByRole('link', { name: '내 문의 내역 보기' })).toHaveAttribute(
      'href',
      '/support/inquiries',
    )
  })

  it('should close on 확인 and strip the one-off query parameter', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<InquirySubmittedDialog detailPath={DETAIL_PATH} />)

    // Act
    await user.click(screen.getByRole('button', { name: '확인' }))

    // Assert — 새로고침에서 모달이 되살아나지 않도록 주소까지 갈아 끼운다.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith(DETAIL_PATH, { scroll: false })
  })

  it('should close on Escape', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<InquirySubmittedDialog detailPath={DETAIL_PATH} />)

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith(DETAIL_PATH, { scroll: false })
  })
})
