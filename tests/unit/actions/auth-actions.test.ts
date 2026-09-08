import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

const REDIRECT_PREFIX = 'NEXT_REDIRECT:'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_PREFIX}${path}`)
  },
}))

/* `refresh()` 는 실제 Server Action 컨텍스트 밖에서 부르면 던진다(Next 16).
   여기서는 "호출됐는지"만 보면 되므로 목으로 대체한다. */
const refresh = vi.fn()
vi.mock('next/cache', () => ({ refresh: (...args: unknown[]) => refresh(...args) }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const signInWithStubProvider = vi.fn()
const markStubProvider = vi.fn()
vi.mock('@/lib/supabase/stub-social', () => ({
  signInWithStubProvider: (...args: unknown[]) => signInWithStubProvider(...args),
  markStubProvider: (...args: unknown[]) => markStubProvider(...args),
}))

const { completeOnboarding, signOut, socialSignIn, stubSocialSignIn, updateAccount } =
  await import('@/lib/actions/auth-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

/**
 * `FEATURES.mswAccountFields` 는 모듈 로드 시점에 굳는 값이다. 이 파일의
 * 정적 import(위)는 env 가 비어 있을 때(기본값, 곧 OFF) 로드됐으므로 아래
 * `completeOnboarding`/`updateAccount` describe 는 기본적으로 OFF 를
 * 검증한다. ON 상태를 확인해야 하는 테스트는 env 를 바꾸고
 * `vi.resetModules()` 로 캐시를 비운 뒤 다시 import 한다.
 */
const FEATURE_ENV_KEY = 'NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS'
const ORIGINAL_FEATURE_ENV = process.env[FEATURE_ENV_KEY]

async function loadAuthActionsWithFlagOn() {
  vi.resetModules()
  process.env[FEATURE_ENV_KEY] = 'true'
  return import('@/lib/actions/auth-actions')
}

afterEach(() => {
  if (ORIGINAL_FEATURE_ENV === undefined) {
    delete process.env[FEATURE_ENV_KEY]
  } else {
    process.env[FEATURE_ENV_KEY] = ORIGINAL_FEATURE_ENV
  }
})

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const COMPLETE_PROFILE = {
  nickname: '모험가',
  terms_agreed_at: '2026-09-08T00:00:00.000Z',
  privacy_agreed_at: '2026-09-08T00:00:00.000Z',
  age_confirmed_at: '2026-09-08T00:00:00.000Z',
  msw_uid: '20123000000000000',
  msw_profile_code: '#abcd1',
}
const VALID_MSW_FIELDS = { mswUid: '20123000000000000', mswProfileCode: '#abcd1' }

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
  refresh.mockReset()
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
    ...VALID_MSW_FIELDS,
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

  it('should stamp all three consent times and the nickname without the MSW account when the feature flag is off', async () => {
    // Arrange & Act
    await completeOnboarding(EMPTY_FORM_STATE, form(valid)).catch(() => undefined)

    // Assert — 플래그가 꺼져 있으면 UID·프로필 코드는 컬럼에 쓰지 않는다(기존 값 보존).
    const [payload] = stub.updates as [Record<string, string>]
    expect(payload.nickname).toBe('모험가')
    expect(payload.msw_uid).toBeUndefined()
    expect(payload.msw_profile_code).toBeUndefined()
    expect(payload.terms_agreed_at).toBeDefined()
    expect(payload.privacy_agreed_at).toBeDefined()
    expect(payload.age_confirmed_at).toBeDefined()
  })

  it('should accept a submission missing the MSW UID and profile code when the feature flag is off', async () => {
    // Arrange & Act — 검증을 통과하면 redirect() 로 빠져나간다(성공).
    const promise = completeOnboarding(
      EMPTY_FORM_STATE,
      form({ ...valid, mswUid: '', mswProfileCode: '' }),
    )

    // Assert
    await expect(promise).rejects.toThrow(REDIRECT_PREFIX)
    expect(stub.updates).toHaveLength(1)
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

  it('should explain a MSW UID collision instead of leaking the constraint', async () => {
    // Arrange — 제약 이름으로 "어떤 필드가 겹쳤는지" 가른다.
    stub = createSupabaseStub([
      {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "profiles_msw_uid_key"',
        },
      },
    ])
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // Act
    const result = await completeOnboarding(EMPTY_FORM_STATE, form(valid))

    // Assert
    expect(result.fieldErrors?.mswUid).toBe('이미 등록된 UID입니다.')
  })
})

describe('completeOnboarding — feature flag ON', () => {
  const valid = {
    nickname: '모험가',
    ...VALID_MSW_FIELDS,
    termsAgreed: 'on',
    privacyAgreed: 'on',
    ageConfirmed: 'on',
  }

  beforeEach(() => {
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('should require the MSW UID and profile code before writing anything', async () => {
    // Arrange
    const { completeOnboarding: completeOnboardingOn } = await loadAuthActionsWithFlagOn()

    // Act
    const result = await completeOnboardingOn(EMPTY_FORM_STATE, form({ ...valid, mswUid: '' }))

    // Assert
    expect(result.fieldErrors?.mswUid).toBeDefined()
    expect(stub.updates).toHaveLength(0)
  })

  it('should stamp the MSW account along with the nickname and consents', async () => {
    // Arrange
    const { completeOnboarding: completeOnboardingOn } = await loadAuthActionsWithFlagOn()

    // Act
    await completeOnboardingOn(EMPTY_FORM_STATE, form(valid)).catch(() => undefined)

    // Assert
    const [payload] = stub.updates as [Record<string, string>]
    expect(payload.nickname).toBe('모험가')
    expect(payload.msw_uid).toBe('20123000000000000')
    expect(payload.msw_profile_code).toBe('#abcd1')
  })

  it('should normalize the profile code before saving (lowercase, leading "#")', async () => {
    // Arrange
    const { completeOnboarding: completeOnboardingOn } = await loadAuthActionsWithFlagOn()

    // Act
    await completeOnboardingOn(
      EMPTY_FORM_STATE,
      form({ ...valid, mswProfileCode: 'ABCD1' }),
    ).catch(() => undefined)

    // Assert
    const [payload] = stub.updates as [Record<string, string>]
    expect(payload.msw_profile_code).toBe('#abcd1')
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

describe('updateAccount', () => {
  const valid = { nickname: '모험가', ...VALID_MSW_FIELDS }

  beforeEach(() => {
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('should send an anonymous visitor to the login page', async () => {
    // Arrange
    stub.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const promise = updateAccount(EMPTY_FORM_STATE, form(valid))

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/login?next=${encodeURIComponent('/account')}`,
    )
  })

  it('should ignore an invalid MSW UID when the feature flag is off', async () => {
    // Arrange & Act — 입력칸이 없어 형식 검증 자체를 하지 않는다.
    const result = await updateAccount(EMPTY_FORM_STATE, form({ ...valid, mswUid: '123' }))

    // Assert
    expect(result.fieldErrors?.mswUid).toBeUndefined()
  })

  it('should save only the nickname (not the MSW account) and refresh the current route', async () => {
    // Arrange & Act
    const result = await updateAccount(EMPTY_FORM_STATE, form(valid))

    // Assert — 플래그가 꺼져 있으면 UID·프로필 코드는 컬럼에 쓰지 않는다(기존 값 보존).
    const [payload] = stub.updates as [Record<string, string>]
    expect(payload.nickname).toBe('모험가')
    expect(payload.msw_uid).toBeUndefined()
    expect(payload.msw_profile_code).toBeUndefined()
    expect(refresh).toHaveBeenCalled()
    expect(result.message).toBe('정보를 저장했습니다.')
  })

  it('should explain a nickname collision instead of leaking the constraint', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: null, error: { code: '23505', message: 'duplicate key' } }])
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // Act
    const result = await updateAccount(EMPTY_FORM_STATE, form(valid))

    // Assert
    expect(result.fieldErrors?.nickname).toBe('이미 사용 중인 닉네임입니다.')
    expect(refresh).not.toHaveBeenCalled()
  })

  it('should explain a MSW UID collision instead of leaking the constraint', async () => {
    // Arrange
    stub = createSupabaseStub([
      {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "profiles_msw_uid_key"',
        },
      },
    ])
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // Act
    const result = await updateAccount(EMPTY_FORM_STATE, form(valid))

    // Assert
    expect(result.fieldErrors?.mswUid).toBe('이미 등록된 UID입니다.')
  })
})

describe('updateAccount — feature flag ON', () => {
  const valid = { nickname: '모험가', ...VALID_MSW_FIELDS }

  beforeEach(() => {
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('should reject an invalid MSW UID before writing anything', async () => {
    // Arrange
    const { updateAccount: updateAccountOn } = await loadAuthActionsWithFlagOn()

    // Act
    const result = await updateAccountOn(EMPTY_FORM_STATE, form({ ...valid, mswUid: '123' }))

    // Assert
    expect(result.fieldErrors?.mswUid).toBeDefined()
    expect(stub.updates).toHaveLength(0)
  })

  it('should save the nickname and MSW account, then refresh the current route', async () => {
    // Arrange
    const { updateAccount: updateAccountOn } = await loadAuthActionsWithFlagOn()

    // Act
    const result = await updateAccountOn(EMPTY_FORM_STATE, form(valid))

    // Assert
    const [payload] = stub.updates as [Record<string, string>]
    expect(payload.nickname).toBe('모험가')
    expect(payload.msw_uid).toBe('20123000000000000')
    expect(payload.msw_profile_code).toBe('#abcd1')
    expect(refresh).toHaveBeenCalled()
    expect(result.message).toBe('정보를 저장했습니다.')
  })
})
