import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MarketingConsentDialog } from '@/components/auth/MarketingConsentDialog'
import { MARKETING_CONSENT_SUMMARY, MARKETING_CONSENT_TITLE } from '@/lib/content/marketing-consent'

const HTML = '<h2>5. 야간 전송 제한</h2><p>오후 9시부터 다음 날 오전 8시까지는…</p>'

function renderDialog(open: boolean) {
  const onClose = vi.fn()
  const onAgree = vi.fn()

  render(<MarketingConsentDialog open={open} onClose={onClose} onAgree={onAgree} html={HTML} />)

  return { onClose, onAgree }
}

describe('MarketingConsentDialog', () => {
  it('should render nothing while it is closed', () => {
    // Arrange & Act
    renderDialog(false)

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should show the notice body and the link to the full document', () => {
    // Arrange & Act
    renderDialog(true)

    // Assert
    expect(screen.getByRole('dialog')).toHaveAccessibleName(MARKETING_CONSENT_TITLE)
    expect(screen.getByText(MARKETING_CONSENT_SUMMARY)).toBeVisible()
    expect(screen.getByRole('heading', { name: '5. 야간 전송 제한', level: 2 })).toBeVisible()
    expect(screen.getByRole('link', { name: '마케팅 정보 수신 동의 전문 보기' })).toHaveAttribute(
      'href',
      '/policy/marketing',
    )
  })

  it('should close on 확인 without agreeing', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onClose, onAgree } = renderDialog(true)

    // Act
    await user.click(screen.getByRole('button', { name: '확인' }))

    // Assert
    expect(onClose).toHaveBeenCalledOnce()
    expect(onAgree).not.toHaveBeenCalled()
  })

  it('should tick the consent from 동의하고 닫기', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onAgree } = renderDialog(true)

    // Act
    await user.click(screen.getByRole('button', { name: '동의하고 닫기' }))

    // Assert
    expect(onAgree).toHaveBeenCalledOnce()
  })

  it('should close on Escape', async () => {
    // Arrange
    const user = userEvent.setup()
    const { onClose } = renderDialog(true)

    // Act
    await user.keyboard('{Escape}')

    // Assert
    expect(onClose).toHaveBeenCalled()
  })
})
