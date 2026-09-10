import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'

import { ONBOARDING_COPY } from '@/lib/content/onboarding'

import type { FormState } from '@/lib/actions/form-state'

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 온다. 실패 응답만 흉내 낸다. */
const completeOnboarding = vi.fn<(previous: FormState, formData: FormData) => Promise<FormState>>()
vi.mock('@/lib/actions/auth-actions', () => ({
  completeOnboarding: (previous: FormState, formData: FormData) =>
    completeOnboarding(previous, formData),
  signOutToLogin: async () => undefined,
}))

const { OnboardingForm } = await import('@/components/auth/OnboardingForm')

const DEFAULT_PROPS = {
  nextPath: '/',
  defaultNickname: '',
  defaultMswUid: '',
  defaultMswProfileCode: '',
  marketingConsentHtml: '<h2>1. 동의의 성격과 근거 법령</h2><p>선택 항목입니다.</p>',
}

function checkboxOf(name: string): HTMLInputElement {
  const element = document.querySelector<HTMLInputElement>(`input[name="${name}"]`)
  expect(element, `${name} 체크박스를 찾지 못했다`).not.toBeNull()

  return element as HTMLInputElement
}

function submitButton(): HTMLButtonElement {
  return screen.getByRole('button', { name: ONBOARDING_COPY.submit }) as HTMLButtonElement
}

/** 활성 조건을 모두 채운다 — 닉네임 + 필수 약관 두 개 + 만 14세. */
async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(ONBOARDING_COPY.nicknameLabel), '글자월드')
  await user.click(checkboxOf('termsAgreed'))
  await user.click(checkboxOf('privacyAgreed'))
  await user.click(checkboxOf('ageConfirmed'))
}

beforeEach(() => {
  completeOnboarding.mockReset()
  completeOnboarding.mockResolvedValue({})
})

/* 회원가입 실패 카드(시안 27:5161) — 폼에서 갈아타고 되돌아오는 흐름까지 본다. */
it('should show the failure card and keep the values for the retry', async () => {
  // Arrange
  const user = userEvent.setup()
  completeOnboarding.mockResolvedValue({ formError: '회원가입에 실패했습니다.' })
  render(<OnboardingForm {...DEFAULT_PROPS} />)
  await fillRequired(user)

  // Act
  await user.click(submitButton())

  // Assert — 화면이 실패 카드로 바뀐다.
  await waitFor(() => {
    expect(
      screen.getByRole('heading', { name: ONBOARDING_COPY.failureTitle, level: 1 }),
    ).toBeVisible()
  })
  expect(screen.getByText(ONBOARDING_COPY.failureBody[0])).toBeVisible()
  expect(screen.getByRole('button', { name: ONBOARDING_COPY.backToLogin })).toBeVisible()

  // Act — 다시 시도하기.
  await user.click(screen.getByRole('button', { name: ONBOARDING_COPY.retry }))

  // Assert — 입력해 둔 값이 그대로다.
  expect(screen.getByLabelText(ONBOARDING_COPY.nicknameLabel)).toHaveValue('글자월드')
  expect(checkboxOf('termsAgreed').checked).toBe(true)
  expect(submitButton()).toBeEnabled()
})

it('should keep a nickname collision inside the form', async () => {
  // Arrange
  const user = userEvent.setup()
  completeOnboarding.mockResolvedValue({
    fieldErrors: { nickname: ONBOARDING_COPY.nicknameTaken },
  })
  render(<OnboardingForm {...DEFAULT_PROPS} />)
  await fillRequired(user)

  // Act
  await user.click(submitButton())

  // Assert — 실패 카드가 아니라 입력 아래 도움말이 바뀐다.
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent(ONBOARDING_COPY.nicknameTaken)
  })
  expect(screen.queryByText(ONBOARDING_COPY.failureTitle)).not.toBeInTheDocument()

  // Act — 값을 고치면 안내가 사라진다.
  await user.type(screen.getByLabelText(ONBOARDING_COPY.nicknameLabel), '2')

  // Assert
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})
