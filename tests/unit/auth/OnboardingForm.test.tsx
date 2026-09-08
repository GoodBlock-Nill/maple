import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 오므로 jsdom 에서 그대로
   import 할 수 없다. 폼 액션은 이 테스트의 관심사가 아니라서 비워 둔다. */
vi.mock('@/lib/actions/auth-actions', () => ({
  completeOnboarding: async () => ({}),
}))

/**
 * `FEATURES` 를 목으로 바꿔치기하고 필드 하나만 테스트마다 뒤집는다.
 *
 * `vi.resetModules()` + 재 import 방식은 React 모듈까지 새로 불러와
 * `@testing-library/react` 가 붙잡고 있는 React 인스턴스와 어긋난다(두 개의
 * React 사본이 섞이면 렌더는 되지만 쿼리 유틸이 요소를 못 찾는다). 대신 이
 * 목 객체 하나를 계속 재사용하고 값만 바꿔서 그 문제를 피한다.
 */
const mockFeatures = { mswAccountFields: false }
vi.mock('@/lib/constants/features', () => ({ FEATURES: mockFeatures }))

const { OnboardingForm } = await import('@/components/auth/OnboardingForm')

beforeEach(() => {
  mockFeatures.mswAccountFields = false
})

const DEFAULT_PROPS = {
  nextPath: '/',
  defaultNickname: '구글테스터',
  defaultMswUid: '',
  defaultMswProfileCode: '',
}

describe('OnboardingForm — feature flag OFF', () => {
  it('should render only the nickname field and the three consents', () => {
    // Arrange & Act
    render(<OnboardingForm {...DEFAULT_PROPS} />)

    // Assert — UID·프로필 코드 입력칸이 없어야 한다.
    expect(screen.getByLabelText('닉네임', { exact: false })).toBeInTheDocument()
    expect(
      screen.queryByLabelText('메이플스토리 월드 계정 UID', { exact: false }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByLabelText('메이플스토리 월드 프로필 코드', { exact: false }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('이용약관')).toBeInTheDocument()
    expect(screen.getByText('개인정보처리방침')).toBeInTheDocument()
    expect(screen.getByText('만 14세 이상입니다.')).toBeInTheDocument()
  })
})

describe('OnboardingForm — feature flag ON', () => {
  it('should render the MSW UID and profile code fields alongside the nickname', () => {
    // Arrange
    mockFeatures.mswAccountFields = true

    // Act
    render(<OnboardingForm {...DEFAULT_PROPS} />)

    // Assert
    expect(screen.getByLabelText('닉네임', { exact: false })).toBeInTheDocument()
    expect(
      screen.getByLabelText('메이플스토리 월드 계정 UID', { exact: false }),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText('메이플스토리 월드 프로필 코드', { exact: false }),
    ).toBeInTheDocument()
  })
})
