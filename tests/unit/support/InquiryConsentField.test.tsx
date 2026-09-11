import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { InquiryConsentField } from '@/components/support/InquiryConsentField'
import { CHECK_MARK_TEST_ID } from '@/components/support/SupportCheckbox'
import { PRIVACY_CONSENT_LABEL } from '@/lib/constants/support'

/**
 * 개인정보 수집·이용 동의 체크박스.
 *
 * 2026-09-11 오너 제보 — `appearance: none` 이 네이티브 체크 표시까지 지워서 켠
 * 상태가 **표시 없는 검은 사각형**으로 보였다. 다시 그렇게 되지 않도록
 * "보이는 상자 + 켜지면 체크 그림"을 여기서 고정한다.
 */

/** 눈에 보이지 않게 만드는 상용 클래스들. 상자 자체에 붙으면 안 된다. */
const HIDING_CLASSES = ['sr-only', 'hidden', 'opacity-0', 'invisible']

function consentBox(): HTMLInputElement {
  return screen.getByRole('checkbox', { name: PRIVACY_CONSENT_LABEL })
}

describe('InquiryConsentField', () => {
  it('should render the consent checkbox as a visible control', () => {
    // Arrange & Act
    render(<InquiryConsentField />)

    // Assert — 라벨로 찾히고(접근성 이름), 화면에서도 보인다.
    const box = consentBox()

    expect(box).toBeInTheDocument()
    expect(box).toBeVisible()
    expect(box).toBeRequired()

    for (const hiding of HIDING_CLASSES) {
      expect(box.className.split(/\s+/u)).not.toContain(hiding)
    }
  })

  it('should show a check mark when toggled on and drop it when toggled off', async () => {
    // Arrange
    const user = userEvent.setup()

    render(<InquiryConsentField />)

    // Assert — 꺼진 상태에는 체크 그림이 없다(빈 상자).
    expect(screen.queryByTestId(CHECK_MARK_TEST_ID)).not.toBeInTheDocument()

    // Act
    await user.click(consentBox())

    // Assert — 켜지면 상태와 그림이 함께 바뀐다.
    expect(consentBox()).toBeChecked()
    expect(screen.getByTestId(CHECK_MARK_TEST_ID)).toBeInTheDocument()

    // Act
    await user.click(consentBox())

    // Assert
    expect(consentBox()).not.toBeChecked()
    expect(screen.queryByTestId(CHECK_MARK_TEST_ID)).not.toBeInTheDocument()
  })

  it('should toggle from the label text too', async () => {
    // Arrange
    const user = userEvent.setup()

    render(<InquiryConsentField />)

    // Act
    await user.click(screen.getByText(PRIVACY_CONSENT_LABEL))

    // Assert
    expect(consentBox()).toBeChecked()
  })

  it('should tie the server error to the checkbox', () => {
    // Arrange
    const message = '개인정보 수집 및 이용에 동의해 주세요.'

    // Act
    render(<InquiryConsentField error={message} />)

    // Assert — 오류 문구가 보이고, 체크박스가 그 문구를 가리킨다.
    const alert = screen.getByRole('alert')

    expect(alert).toHaveTextContent(message)
    expect(consentBox()).toHaveAttribute('aria-describedby', alert.id)
  })

  it('should not describe the checkbox when there is no error', () => {
    // Arrange & Act
    render(<InquiryConsentField />)

    // Assert
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(consentBox()).not.toHaveAttribute('aria-describedby')
  })
})
