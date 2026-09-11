import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { InquiryForm } from '@/components/support/InquiryForm'
import { CHECK_MARK_TEST_ID } from '@/components/support/SupportCheckbox'
import { PRIVACY_CONSENT_LABEL } from '@/lib/constants/support'

import type { InquiryCategoryOption } from '@/types/domain'

/* 서버 액션은 단위 테스트에서 부를 수 없다(`next/headers` · Supabase). 폼이 잠금을
   푸는 조건만 보므로 호출을 받아 두기만 한다. */
vi.mock('@/lib/actions/inquiry-actions', () => ({
  createInquiry: vi.fn(async () => ({})),
}))
vi.mock('@/lib/actions/inquiry-edit-actions', () => ({
  updateInquiry: vi.fn(async () => ({})),
}))

const CATEGORIES: readonly InquiryCategoryOption[] = [
  {
    key: 'etc',
    label: '기타·건의',
    description: null,
    prefill: '',
    subtypes: [],
  },
]

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: '문의 등록하기' })
}

/** 동의를 뺀 나머지 필수 항목. 이것만으로는 제출이 열리지 않아야 한다. */
async function fillRequiredExceptConsent(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByRole('textbox', { name: /글자월드 계정 ID/u }), 'gjstory01')
  await user.selectOptions(
    screen.getByRole('combobox', { name: /카테고리 및 유형 선택/u }),
    '기타·건의',
  )
  await user.type(screen.getByRole('textbox', { name: /제목/u }), '문의 제목')
  await user.type(screen.getByRole('textbox', { name: /문의 내용/u }), '문의 내용입니다.')
}

describe('InquiryForm 동의 체크박스', () => {
  it('should render a visible consent checkbox on the create form', () => {
    // Arrange & Act
    render(<InquiryForm isAuthenticated categories={CATEGORIES} />)

    // Assert
    const consent = screen.getByRole('checkbox', { name: PRIVACY_CONSENT_LABEL })

    expect(consent).toBeVisible()
    expect(consent).toHaveAttribute('name', 'consent')
  })

  it('should keep submit locked until the consent box is checked', async () => {
    // Arrange
    const user = userEvent.setup()

    render(<InquiryForm isAuthenticated categories={CATEGORIES} />)

    // Act — 동의만 빼고 모두 채운다.
    await fillRequiredExceptConsent(user)

    // Assert — 동의가 없으면 잠긴 채다.
    expect(submitButton()).toBeDisabled()
    expect(screen.getByText('필수 항목(*)을 모두 입력해 주세요.')).toBeInTheDocument()

    // Act
    await user.click(screen.getByRole('checkbox', { name: PRIVACY_CONSENT_LABEL }))

    // Assert — 체크 그림이 뜨고 제출이 열린다.
    expect(screen.getByTestId(CHECK_MARK_TEST_ID)).toBeInTheDocument()
    expect(submitButton()).toBeEnabled()
  })

  it('should not ask for consent again on the edit form', () => {
    // Arrange & Act
    render(
      <InquiryForm
        isAuthenticated
        categories={CATEGORIES}
        inquiryId="11111111-1111-4111-8111-111111111111"
        defaultValues={{
          accountId: 'gjstory01',
          category: '기타·건의',
          type: '기타',
          title: '문의 제목',
          content: '문의 내용입니다.',
        }}
      />,
    )

    // Assert — 동의는 접수 시점에 이미 받았다.
    expect(screen.queryByRole('checkbox', { name: PRIVACY_CONSENT_LABEL })).not.toBeInTheDocument()
  })
})
