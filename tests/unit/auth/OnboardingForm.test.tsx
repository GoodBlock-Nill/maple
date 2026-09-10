import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ONBOARDING_COPY } from '@/lib/content/onboarding'

import type { FormState } from '@/lib/actions/form-state'

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 오므로 jsdom 에서 그대로
   import 할 수 없다. 폼이 무엇을 받는지가 아니라 무엇을 그리는지가 관심사다. */
const completeOnboarding = vi.fn<(previous: FormState, formData: FormData) => Promise<FormState>>()
vi.mock('@/lib/actions/auth-actions', () => ({
  completeOnboarding: (previous: FormState, formData: FormData) =>
    completeOnboarding(previous, formData),
  signOutToLogin: async () => undefined,
}))

/* `FEATURES.mswAccountFields` 는 기본값(꺼짐) 그대로 쓴다 — 시안에 월드 계정
   입력칸이 없다. 켜진 경우의 입력칸은 `OnboardingMswFields` 가 따로 책임진다. */
const { OnboardingForm } = await import('@/components/auth/OnboardingForm')

const DEFAULT_PROPS = {
  nextPath: '/',
  defaultNickname: '',
  defaultMswUid: '',
  defaultMswProfileCode: '',
  marketingConsentHtml: '<h2>1. 동의의 성격과 근거 법령</h2><p>선택 항목입니다.</p>',
}

const CONSENT_NAMES = ['termsAgreed', 'privacyAgreed', 'marketingAgreed', 'ageConfirmed'] as const

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

describe('OnboardingForm — 시안 기본 상태', () => {
  it('should render the title, the nickname field and the four consent checkboxes', () => {
    // Arrange & Act
    render(<OnboardingForm {...DEFAULT_PROPS} />)

    // Assert — 시안(27:5172)에는 월드 계정 입력칸이 없다.
    expect(screen.getByRole('heading', { name: ONBOARDING_COPY.title, level: 1 })).toBeVisible()
    expect(screen.getByText(ONBOARDING_COPY.subtitle)).toBeVisible()
    expect(screen.getByLabelText(ONBOARDING_COPY.nicknameLabel)).toBeInTheDocument()
    expect(
      screen.queryByLabelText('메이플스토리 월드 계정 UID', { exact: false }),
    ).not.toBeInTheDocument()

    for (const name of CONSENT_NAMES) {
      expect(checkboxOf(name).checked).toBe(false)
    }

    expect(screen.getByText('[선택]')).toBeVisible()
    expect(screen.getByText(ONBOARDING_COPY.ageConfirm)).toBeVisible()
  })

  it('should keep the submit button disabled until every requirement is met', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<OnboardingForm {...DEFAULT_PROPS} />)

    // Assert — 아무것도 안 했을 때.
    expect(submitButton()).toBeDisabled()

    // Act — 닉네임만.
    await user.type(screen.getByLabelText(ONBOARDING_COPY.nicknameLabel), '글자월드')
    expect(submitButton()).toBeDisabled()

    // Act — 필수 약관 둘.
    await user.click(checkboxOf('termsAgreed'))
    await user.click(checkboxOf('privacyAgreed'))
    expect(submitButton()).toBeDisabled()

    // Act — 만 14세까지.
    await user.click(checkboxOf('ageConfirmed'))

    // Assert — 마케팅(선택)은 조건이 아니다.
    expect(submitButton()).toBeEnabled()
    expect(checkboxOf('marketingAgreed').checked).toBe(false)
  })

  it('should disable the button again when the nickname breaks the rule', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<OnboardingForm {...DEFAULT_PROPS} />)
    await fillRequired(user)

    // Act — 한글·영문·숫자·밑줄 밖의 문자.
    await user.clear(screen.getByLabelText(ONBOARDING_COPY.nicknameLabel))
    await user.type(screen.getByLabelText(ONBOARDING_COPY.nicknameLabel), '^^')

    // Assert
    expect(screen.getByRole('alert')).toHaveTextContent(ONBOARDING_COPY.nicknameInvalid)
    expect(submitButton()).toBeDisabled()
  })

  it('should stop the nickname at 12 characters', () => {
    // Arrange & Act
    render(<OnboardingForm {...DEFAULT_PROPS} />)

    // Assert
    expect(screen.getByLabelText(ONBOARDING_COPY.nicknameLabel)).toHaveAttribute('maxLength', '12')
  })
})

describe('OnboardingForm — 도움말과 지우기', () => {
  it('should swap the hint once the visitor typed something', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<OnboardingForm {...DEFAULT_PROPS} />)

    // Assert — 비었을 때는 규칙 전체를 알려 준다.
    expect(screen.getByText(ONBOARDING_COPY.nicknameHint)).toBeVisible()

    // Act
    await user.type(screen.getByLabelText(ONBOARDING_COPY.nicknameLabel), '글')

    // Assert
    expect(screen.getByText(ONBOARDING_COPY.nicknameHintTyping)).toBeVisible()
  })

  it('should show a clear icon only while the field has a value and empty it on click', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<OnboardingForm {...DEFAULT_PROPS} />)
    const field = screen.getByLabelText(ONBOARDING_COPY.nicknameLabel)

    // Assert
    expect(
      screen.queryByRole('button', { name: ONBOARDING_COPY.nicknameClear }),
    ).not.toBeInTheDocument()

    // Act
    await user.type(field, '글자월드')
    await user.click(screen.getByRole('button', { name: ONBOARDING_COPY.nicknameClear }))

    // Assert
    expect(field).toHaveValue('')
    expect(
      screen.queryByRole('button', { name: ONBOARDING_COPY.nicknameClear }),
    ).not.toBeInTheDocument()
  })
})

describe('OnboardingForm — 전체 동의', () => {
  it('should turn all four consents on and off at once', async () => {
    // Arrange — 닉네임까지 채워 두면 버튼 활성/비활성도 이 한 번의 클릭에 달린다.
    const user = userEvent.setup()
    render(<OnboardingForm {...DEFAULT_PROPS} />)
    await user.type(screen.getByLabelText(ONBOARDING_COPY.nicknameLabel), '글자월드')
    const all = checkboxOf('agreeAll')

    // Act
    await user.click(all)

    // Assert — 필수 둘 + 선택 하나 + 만 14세가 모두 켜지고 버튼이 열린다.
    for (const name of CONSENT_NAMES) {
      expect(checkboxOf(name).checked, name).toBe(true)
    }
    expect(submitButton()).toBeEnabled()

    // Act
    await user.click(all)

    // Assert
    for (const name of CONSENT_NAMES) {
      expect(checkboxOf(name).checked, name).toBe(false)
    }
    expect(submitButton()).toBeDisabled()
  })

  it('should show the check mark from state, not from a CSS pseudo class', async () => {
    /* 실기기에서 "전체 동의를 눌러도 아래 세 항목이 체크되지 않는다"는 보고가 있었다.
       체크 그림을 `:checked` + 배경 이미지에 맡기면 상태와 그림이 갈라질 수 있어
       리액트 상태로 그린다 — 켜진 칸 수만큼 체크 아이콘이 있어야 한다. */
    const user = userEvent.setup()
    render(<OnboardingForm {...DEFAULT_PROPS} />)

    // Act
    await user.click(checkboxOf('agreeAll'))

    // Assert — 전체 동의 + 항목 넷.
    expect(document.querySelectorAll('svg rect[fill="#2A2A2A"]')).toHaveLength(
      CONSENT_NAMES.length + 1,
    )
  })

  it('should tick itself only when every item is checked', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<OnboardingForm {...DEFAULT_PROPS} />)

    // Act — 셋만 켠다.
    await user.click(checkboxOf('termsAgreed'))
    await user.click(checkboxOf('privacyAgreed'))
    await user.click(checkboxOf('ageConfirmed'))

    // Assert
    expect(checkboxOf('agreeAll').checked).toBe(false)

    // Act — 선택 항목까지.
    await user.click(checkboxOf('marketingAgreed'))

    // Assert
    expect(checkboxOf('agreeAll').checked).toBe(true)
  })
})

describe('OnboardingForm — 마케팅 안내 모달', () => {
  it('should open the notice from the arrow and tick the consent from 동의하고 닫기', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<OnboardingForm {...DEFAULT_PROPS} />)

    // Act — 필수 약관은 새 탭 링크, 마케팅만 같은 화면 모달이다.
    await user.click(screen.getByRole('button', { name: '마케팅 수신 안내 보기' }))

    // Assert
    expect(screen.getByRole('dialog')).toBeVisible()
    expect(screen.getByRole('heading', { name: '1. 동의의 성격과 근거 법령' })).toBeVisible()

    // Act
    await user.click(screen.getByRole('button', { name: '동의하고 닫기' }))

    // Assert
    expect(checkboxOf('marketingAgreed').checked).toBe(true)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should send the required consents to their published documents in a new tab', () => {
    // Arrange & Act
    render(<OnboardingForm {...DEFAULT_PROPS} />)

    // Assert
    expect(screen.getByRole('link', { name: '이용약관 보기' })).toHaveAttribute(
      'href',
      '/policy/operating',
    )
    expect(screen.getByRole('link', { name: '개인정보처리방침 보기' })).toHaveAttribute(
      'target',
      '_blank',
    )
  })
})
