import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { InquirySubmittedDialog } from '@/components/support/InquirySubmittedDialog'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

const DETAIL_PATH = '/support/inquiries/33333333-0000-4000-8000-000000000001'
const INQUIRY_NO = 1024

beforeEach(() => {
  replace.mockReset()
})

describe('InquirySubmittedDialog', () => {
  it('should open as a labelled modal with the next steps', () => {
    // Arrange & Act
    render(<InquirySubmittedDialog detailPath={DETAIL_PATH} inquiryNo={INQUIRY_NO} />)

    // Assert
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAccessibleName('문의가 접수되었습니다')
    expect(screen.getByText(/운영자가 확인 후 답변을 등록하면/)).toBeInTheDocument()
  })

  it('should show the receipt number so the user can write it down', () => {
    // Arrange & Act
    render(<InquirySubmittedDialog detailPath={DETAIL_PATH} inquiryNo={INQUIRY_NO} />)

    /* Assert — 접수번호는 이 모달을 닫고 나면 상세·목록에서만 볼 수 있다. 고객센터에
       전화하는 사용자는 그 전에 적어 둔다. */
    expect(screen.getByTestId('inquiry-receipt')).toHaveTextContent(
      '접수번호 #1024 — 문의 내역에서 확인할 수 있습니다.',
    )
  })

  it('should offer a link to the inquiry list', () => {
    // Arrange & Act
    render(<InquirySubmittedDialog detailPath={DETAIL_PATH} inquiryNo={INQUIRY_NO} />)

    // Assert
    expect(screen.getByRole('link', { name: '내 문의 내역 보기' })).toHaveAttribute(
      'href',
      '/support/inquiries',
    )
  })

  it('should close on 확인 and strip the one-off query parameter', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<InquirySubmittedDialog detailPath={DETAIL_PATH} inquiryNo={INQUIRY_NO} />)

    // Act
    await user.click(screen.getByRole('button', { name: '확인' }))

    // Assert — 새로고침에서 모달이 되살아나지 않도록 주소까지 갈아 끼운다.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith(DETAIL_PATH, { scroll: false })
  })

  it('should close on Escape', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<InquirySubmittedDialog detailPath={DETAIL_PATH} inquiryNo={INQUIRY_NO} />)

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(replace).toHaveBeenCalledWith(DETAIL_PATH, { scroll: false })
  })
})
