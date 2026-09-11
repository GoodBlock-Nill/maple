import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { FormState } from '@/lib/actions/form-state'

/**
 * "계정 연동" 카드(시안 v2 §4).
 *
 * 플래그가 꺼져 있으면 화면을 지우지 않고 비활성으로 남긴다 — 오너 요청과 같은
 * 방식이다. 켜져 있으면 저장되고 성공은 모달로 알린다.
 */
const updateMswLinkAction = vi.fn<(prev: FormState, formData: FormData) => Promise<FormState>>()

vi.mock('@/lib/actions/profile-actions', () => ({
  updateMswLinkAction: (prev: FormState, formData: FormData) => updateMswLinkAction(prev, formData),
}))

const { MSW_LINK_COMING_SOON_NOTICE, MSW_LINKED_DIALOG_TITLE, MswLinkCard } =
  await import('@/components/account/MswLinkCard')

beforeEach(() => {
  updateMswLinkAction.mockReset()
  updateMswLinkAction.mockResolvedValue({ message: MSW_LINKED_DIALOG_TITLE })
})

function renderCard(enabled: boolean) {
  return render(
    <MswLinkCard activeHref="/account/link" mswUid="" mswProfileCode="" enabled={enabled} />,
  )
}

describe('MswLinkCard — 플래그 OFF(준비 중)', () => {
  it('should disable both inputs and the submit button', () => {
    // Arrange & Act
    renderCard(false)

    // Assert
    expect(screen.getByLabelText('글자월드 계정 UID')).toBeDisabled()
    expect(screen.getByLabelText('글자월드 프로필 코드')).toBeDisabled()
    expect(screen.getByRole('button', { name: '계정 연동하기' })).toBeDisabled()
  })

  it('should say why the form is locked', () => {
    // Arrange & Act
    renderCard(false)

    // Assert — 사이드바 "준비중" 배지와 같은 사실을 문장으로도 남긴다.
    expect(screen.getByText(MSW_LINK_COMING_SOON_NOTICE)).toBeInTheDocument()
  })
})

describe('MswLinkCard — 플래그 ON', () => {
  it('should keep the fields usable and drop the 준비 중 line', () => {
    // Arrange & Act
    renderCard(true)

    // Assert
    expect(screen.getByLabelText('글자월드 계정 UID')).toBeEnabled()
    expect(screen.getByRole('button', { name: '계정 연동하기' })).toBeEnabled()
    expect(screen.queryByText(MSW_LINK_COMING_SOON_NOTICE)).not.toBeInTheDocument()
  })

  it('should show the helper text from the 시안', () => {
    // Arrange & Act
    renderCard(true)

    // Assert
    expect(screen.getByText('UID 확인: 메이플스토리 월드 > 설정 > 계정')).toBeInTheDocument()
    expect(
      screen.getByText('프로필 코드 확인: 메이플스토리 월드 > 더보기 > 프로필 편집'),
    ).toBeInTheDocument()
  })

  it('should send both fields and confirm success with a modal', async () => {
    // Arrange
    const user = userEvent.setup()
    renderCard(true)

    // Act
    await user.type(screen.getByLabelText('글자월드 계정 UID'), '20123456789000000')
    await user.type(screen.getByLabelText('글자월드 프로필 코드'), '#abcd0')
    await user.click(screen.getByRole('button', { name: '계정 연동하기' }))

    // Assert
    const formData = updateMswLinkAction.mock.calls[0]?.[1]
    expect(formData?.get('mswUid')).toBe('20123456789000000')
    expect(formData?.get('mswProfileCode')).toBe('#abcd0')
    expect(await screen.findByRole('dialog')).toHaveTextContent(MSW_LINKED_DIALOG_TITLE)
  })

  it('should put a duplicate-uid error next to its own field', async () => {
    // Arrange
    const user = userEvent.setup()
    updateMswLinkAction.mockResolvedValue({
      fieldErrors: {
        mswUid: '이미 다른 계정에 연결된 월드 계정 UID입니다. 고객지원에 문의해 주세요.',
      },
    })
    renderCard(true)

    // Act
    await user.type(screen.getByLabelText('글자월드 계정 UID'), '20123456789000000')
    await user.type(screen.getByLabelText('글자월드 프로필 코드'), '#abcd0')
    await user.click(screen.getByRole('button', { name: '계정 연동하기' }))

    // Assert
    expect(await screen.findByRole('alert')).toHaveTextContent('이미 다른 계정에 연결된')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
