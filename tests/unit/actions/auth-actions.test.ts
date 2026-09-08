import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

const REDIRECT_PREFIX = 'NEXT_REDIRECT:'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_PREFIX}${path}`)
  },
}))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const signInWithStubProvider = vi.fn()
const markStubProvider = vi.fn()
vi.mock('@/lib/supabase/stub-social', () => ({
  signInWithStubProvider: (...args: unknown[]) => signInWithStubProvider(...args),
  markStubProvider: (...args: unknown[]) => markStubProvider(...args),
}))

const { completeOnboarding, signOut, socialSignIn, stubSocialSignIn } =
  await import('@/lib/actions/auth-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const COMPLETE_PROFILE = {
  nickname: '모험가',
  terms_agreed_at: '2026-09-08T00:00:00.000Z',
  privacy_agreed_at: '2026-09-08T00:00:00.000Z',
  age_confirmed_at: '2026-09-08T00:00:00.000Z',
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

beforeEach(() => {
  stub = createSupabaseStub()
  signInWithStubProvider.mockReset()
  signInWithStubProvider.mockResolvedValue({ ok: true, userId: USER_ID, isAnonymous: true })
  markStubProvider.mockReset()
  delete process.env.SOCIAL_LOGIN_MODE
})

describe('socialSignIn', () => {
  it('should refuse a provider it does not know', async () => {
    // Arrange & Act
    const result = await socialSignIn(EMPTY_FORM_STATE, form({ provider: 'apple' }))

    // Assert — 직접 POST 로 임의 값이 올 수 있다. 500 대신 안내를 준다.
    expect(result.formError).toBe('아직 준비 중인 로그인 방식입니다.')
    expect(signInWithStubProvider).not.toHaveBeenCalled()
  })

  it('should send a first-time user to onboarding', async () => {
    // Arrange — 프로필 조회 결과가 비어 있으면 온보딩 미완료다.
    stub = createSupabaseStub([{ data: null, error: null }])

    // Act
    const promise = socialSignIn(EMPTY_FORM_STATE, form({ provider: 'kakao', next: '/community' }))

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/auth/onboarding?next=${encodeURIComponent('/community')}`,
    )
    expect(signInWithStubProvider).toHaveBeenCalledWith(stub.client, 'kakao')
  })

  it('should record which button the user pressed', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: COMPLETE_PROFILE, error: null }])

    // Act
    await socialSignIn(EMPTY_FORM_STATE, form({ provider: 'naver' })).catch(() => undefined)

    // Assert
    expect(markStubProvider).toHaveBeenCalledWith(USER_ID, 'naver')
  })

  it('should go straight to the destination once onboarding is done', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: COMPLETE_PROFILE, error: null }])

    // Act
    const promise = socialSignIn(
      EMPTY_FORM_STATE,
      form({ provider: 'google', next: '/community/write' }),
    )

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/community/write`)
  })

  it('should ignore an off-origin next path', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: COMPLETE_PROFILE, error: null }])

    // Act
    const promise = socialSignIn(
      EMPTY_FORM_STATE,
      form({ provider: 'google', next: 'https://evil.example' }),
    )

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/`)
  })

  it('should surface a friendly message when sign-in fails', async () => {
    // Arrange
    signInWithStubProvider.mockResolvedValue({ ok: false, message: '로그인에 실패했습니다.' })

    // Act
    const result = await socialSignIn(EMPTY_FORM_STATE, form({ provider: 'kakao' }))

    // Assert
    expect(result.formError).toBe('로그인에 실패했습니다.')
  })
})

describe('stubSocialSignIn', () => {
  it('should answer "준비 중" when the site is switched to real oauth', async () => {
    // Arrange — 실 OAuth 모드인데 제공자가 아직 연결되지 않은 상태.
    process.env.SOCIAL_LOGIN_MODE = 'oauth'

    // Act
    const result = await stubSocialSignIn('google')

    // Assert
    expect(result.formError).toBe('아직 준비 중인 로그인 방식입니다.')
    expect(signInWithStubProvider).not.toHaveBeenCalled()
  })
})

describe('completeOnboarding', () => {
  const valid = {
    nickname: '모험가',
    termsAgreed: 'on',
    privacyAgreed: 'on',
    ageConfirmed: 'on',
  }

  beforeEach(() => {
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('should send an anonymous visitor to the login page', async () => {
    // Arrange
    stub.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const promise = completeOnboarding(EMPTY_FORM_STATE, form(valid))

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/login?next=${encodeURIComponent('/auth/onboarding')}`,
    )
  })

  it('should require every consent before writing anything', async () => {
    // Arrange & Act
    const result = await completeOnboarding(
      EMPTY_FORM_STATE,
      form({ nickname: '모험가', termsAgreed: 'on' }),
    )

    // Assert
    expect(result.fieldErrors?.privacyAgreed).toBeDefined()
    expect(result.fieldErrors?.ageConfirmed).toBeDefined()
    expect(stub.updates).toHaveLength(0)
  })

  it('should stamp all three consent times and the nickname', async () => {
    // Arrange & Act
    await completeOnboarding(EMPTY_FORM_STATE, form(valid)).catch(() => undefined)

    // Assert
    const [payload] = stub.updates as [Record<string, string>]
    expect(payload.nickname).toBe('모험가')
    expect(payload.terms_agreed_at).toBeDefined()
    expect(payload.privacy_agreed_at).toBeDefined()
    expect(payload.age_confirmed_at).toBeDefined()
  })

  it('should redirect to the sanitized destination on success', async () => {
    // Arrange & Act
    const promise = completeOnboarding(EMPTY_FORM_STATE, form({ ...valid, next: '/community' }))

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/community`)
  })

  it('should explain a nickname collision instead of leaking the constraint', async () => {
    // Arrange — 닉네임에는 대소문자 무시 유니크 인덱스가 걸려 있다.
    stub = createSupabaseStub([{ data: null, error: { code: '23505', message: 'duplicate key' } }])
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // Act
    const result = await completeOnboarding(EMPTY_FORM_STATE, form(valid))

    // Assert
    expect(result.fieldErrors?.nickname).toBe('이미 사용 중인 닉네임입니다.')
  })
})

describe('signOut', () => {
  it('should clear the session and send the user home', async () => {
    // Arrange & Act
    const promise = signOut()

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/`)
    expect(stub.client.auth.signOut).toHaveBeenCalled()
  })
})
