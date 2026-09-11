import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * "마케팅 수신 설정"(시안 v2 §3.2) — 체크박스 **하나**가 SMS·이메일 두 칸을 함께
 * 뒤집고, 동의로 바뀔 때만 모달이 뜬다.
 */
const updateMarketingConsentAction = vi.fn()

vi.mock('@/lib/actions/profile-actions', () => ({
  updateMarketingConsentAction: (agreed: boolean) => updateMarketingConsentAction(agreed),
}))

const { MARKETING_AGREED_DIALOG_TITLE, MarketingConsentBox } =
  await import('@/components/account/MarketingConsentBox')

beforeEach(() => {
  updateMarketingConsentAction.mockReset()
  updateMarketingConsentAction.mockResolvedValue({ ok: true })
})

describe('MarketingConsentBox', () => {
  it('should render a single checkbox instead of the v1 SMS/이메일 pair', () => {
    // Arrange & Act
    render(<MarketingConsentBox smsOptOut={false} emailOptOut={false} />)

    // Assert
    expect(screen.getAllByRole('checkbox')).toHaveLength(1)
    expect(screen.getByRole('checkbox', { name: '마케팅 정보 수신 동의' })).toBeChecked()
    expect(screen.queryByText('SMS 수신거부')).not.toBeInTheDocument()
  })

  it('should start unchecked when either channel is opted out', () => {
    // Arrange & Act — 한 칸이라도 수신거부면 "동의하지 않음"으로 본다.
    render(<MarketingConsentBox smsOptOut={false} emailOptOut />)

    // Assert
    expect(screen.getByRole('checkbox')).not.toBeChecked()
  })

  it('should save the consent and confirm it with a modal', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<MarketingConsentBox smsOptOut emailOptOut />)

    // Act
    await user.click(screen.getByRole('checkbox'))

    // Assert
    expect(updateMarketingConsentAction).toHaveBeenCalledWith(true)
    expect(await screen.findByRole('dialog')).toHaveTextContent(MARKETING_AGREED_DIALOG_TITLE)
  })

  it('should close the modal on 확인', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<MarketingConsentBox smsOptOut emailOptOut />)
    await user.click(screen.getByRole('checkbox'))
    await screen.findByRole('dialog')

    // Act
    await user.click(screen.getByRole('button', { name: '확인' }))

    // Assert
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should save a withdrawal of consent silently', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<MarketingConsentBox smsOptOut={false} emailOptOut={false} />)

    // Act — 해제는 모달 없이 저장한다(끄는 동작까지 막지 않는다).
    await user.click(screen.getByRole('checkbox'))

    // Assert
    expect(updateMarketingConsentAction).toHaveBeenCalledWith(false)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should roll the checkbox back and explain a failure', async () => {
    // Arrange
    const user = userEvent.setup()
    updateMarketingConsentAction.mockResolvedValue({ ok: false, message: '저장하지 못했습니다.' })
    render(<MarketingConsentBox smsOptOut emailOptOut />)

    // Act
    await user.click(screen.getByRole('checkbox'))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('저장하지 못했습니다.')
    expect(screen.getByRole('checkbox')).not.toBeChecked()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
