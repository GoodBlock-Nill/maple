import { beforeEach, describe, expect, it, vi } from 'vitest'

const REDIRECT_PREFIX = 'NEXT_REDIRECT:'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_PREFIX}${path}`)
  },
}))

type Result = { data: unknown; error: unknown }

const auth = {
  signInWithPassword: vi.fn(),
  resetPasswordForEmail: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
  signOut: vi.fn(),
}

/** `from('profiles').select(...).eq(...).maybeSingle()` 한 줄만 쓰는 얇은 빌더. */
let profileResult: Result = { data: null, error: null }
const client = {
  auth,
  from: () => {
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'eq']) builder[method] = () => builder
    builder.maybeSingle = async () => profileResult
    return builder
  },
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => client }))

const { requestPasswordReset, signInWithPassword, updatePassword } =
  await import('@/lib/actions/email-auth-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

function form(values: Record<string, string>): FormData {
  const data = new FormData()
  for (const [key, value] of Object.entries(values)) data.set(key, value)
  return data
}

const USER = { id: 'aaaaaaaa-0000-4000-8000-000000000001' }
const COMPLETE_PROFILE = {
  nickname: '모험가',
  terms_agreed_at: '2026-09-10T00:00:00.000Z',
  privacy_agreed_at: '2026-09-10T00:00:00.000Z',
  age_confirmed_at: '2026-09-10T00:00:00.000Z',
  deleted_at: null,
  purged_at: null,
}

beforeEach(() => {
  vi.clearAllMocks()
  profileResult = { data: null, error: null }
  auth.signInWithPassword.mockResolvedValue({ data: { user: USER }, error: null })
  auth.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })
  auth.updateUser.mockResolvedValue({ data: { user: USER }, error: null })
  auth.getUser.mockResolvedValue({ data: { user: USER }, error: null })
  auth.signOut.mockResolvedValue({ error: null })
})

describe('signInWithPassword', () => {
  it('should reject a malformed email before touching Supabase', async () => {
    // Arrange & Act
    const result = await signInWithPassword(
      EMPTY_FORM_STATE,
      form({ email: 'nope', password: 'x' }),
    )

    // Assert
    expect(result.fieldErrors?.email).toBe('이메일 형식이 올바르지 않습니다.')
    expect(auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('should translate wrong credentials into Korean without leaking the raw error', async () => {
    // Arrange
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'invalid_credentials', status: 400, message: 'Invalid login credentials' },
    })

    // Act
    const result = await signInWithPassword(
      EMPTY_FORM_STATE,
      form({ email: 'a@b.co', password: 'wrong' }),
    )

    // Assert
    expect(result.formError).toBe('이메일 또는 비밀번호가 올바르지 않습니다.')
    expect(result.formError).not.toContain('Invalid')
  })

  it('should explain an unconfirmed account', async () => {
    // Arrange
    auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'email_not_confirmed', status: 400, message: 'Email not confirmed' },
    })

    // Act
    const result = await signInWithPassword(
      EMPTY_FORM_STATE,
      form({ email: 'a@b.co', password: 'maple1234' }),
    )

    // Assert
    expect(result.formError).toBe(
      '이메일 인증이 완료되지 않은 계정입니다. 회원가입에서 인증을 마쳐 주세요.',
    )
  })

  it('should send a first-time user to onboarding', async () => {
    // Arrange — 프로필이 없으면 온보딩 미완료다.
    profileResult = { data: null, error: null }

    // Act
    const promise = signInWithPassword(
      EMPTY_FORM_STATE,
      form({ email: 'a@b.co', password: 'maple1234', next: '/community' }),
    )

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/auth/onboarding?next=${encodeURIComponent('/community')}`,
    )
  })

  it('should send a withdrawn account to the restore screen', async () => {
    // Arrange
    profileResult = {
      data: { ...COMPLETE_PROFILE, deleted_at: '2026-09-01T00:00:00.000Z' },
      error: null,
    }

    // Act
    const promise = signInWithPassword(
      EMPTY_FORM_STATE,
      form({ email: 'a@b.co', password: 'maple1234' }),
    )

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/auth/restore?next=${encodeURIComponent('/')}`,
    )
  })

  it('should refuse an off-site next value', async () => {
    // Arrange
    profileResult = { data: COMPLETE_PROFILE, error: null }

    // Act
    const promise = signInWithPassword(
      EMPTY_FORM_STATE,
      form({ email: 'a@b.co', password: 'maple1234', next: 'https://evil.example' }),
    )

    // Assert — 오픈 리다이렉트를 막고 기본 경로로 되돌린다.
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/`)
  })
})

describe('requestPasswordReset', () => {
  it('should answer the same way whether or not the account exists', async () => {
    // Arrange & Act
    const result = await requestPasswordReset(EMPTY_FORM_STATE, form({ email: 'a@b.co' }))

    // Assert — 계정 열거 방지.
    expect(result.message).toContain('가입된 계정이 있다면')
    expect(result.formError).toBeUndefined()
  })

  it('should point the mail link at the confirm route', async () => {
    // Arrange & Act
    await requestPasswordReset(EMPTY_FORM_STATE, form({ email: 'a@b.co' }))

    // Assert
    const [, options] = auth.resetPasswordForEmail.mock.calls[0] as [string, { redirectTo: string }]
    expect(options.redirectTo).toContain('/auth/confirm?type=recovery&next=')
    expect(options.redirectTo).toContain(encodeURIComponent('/reset-password'))
  })

  it('should surface a rate limit instead of pretending the mail was sent', async () => {
    // Arrange
    auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { status: 429, message: 'email rate limit exceeded' },
    })

    // Act
    const result = await requestPasswordReset(EMPTY_FORM_STATE, form({ email: 'a@b.co' }))

    // Assert
    expect(result.formError).toBe('인증번호 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.')
  })
})

describe('updatePassword', () => {
  it('should flag a mismatch on the confirm field', async () => {
    // Arrange & Act
    const result = await updatePassword(
      EMPTY_FORM_STATE,
      form({ password: 'maple1234', passwordConfirm: 'maple12345' }),
    )

    // Assert
    expect(result.fieldErrors?.passwordConfirm).toBe('비밀번호가 일치하지 않습니다.')
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('should ask for a fresh link when the session is gone', async () => {
    // Arrange
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const result = await updatePassword(
      EMPTY_FORM_STATE,
      form({ password: 'maple1234', passwordConfirm: 'maple1234' }),
    )

    // Assert
    expect(result.formError).toContain('비밀번호 찾기를 다시 요청')
  })

  it('should sign out and send the user back to login on success', async () => {
    // Arrange & Act
    const promise = updatePassword(
      EMPTY_FORM_STATE,
      form({ password: 'maple1234', passwordConfirm: 'maple1234' }),
    )

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/login?notice=password_updated`)
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'maple1234' })
    expect(auth.signOut).toHaveBeenCalled()
  })

  it('should translate a same-password rejection', async () => {
    // Arrange
    auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'same_password', message: 'New password should be different' },
    })

    // Act
    const result = await updatePassword(
      EMPTY_FORM_STATE,
      form({ password: 'maple1234', passwordConfirm: 'maple1234' }),
    )

    // Assert
    expect(result.formError).toBe('이전과 다른 비밀번호를 입력해 주세요.')
  })
})
