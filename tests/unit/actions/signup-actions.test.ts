import { beforeEach, describe, expect, it, vi } from 'vitest'

const REDIRECT_PREFIX = 'NEXT_REDIRECT:'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_PREFIX}${path}`)
  },
}))

type Result = { data: unknown; error: unknown }

const auth = {
  signInWithOtp: vi.fn(),
  verifyOtp: vi.fn(),
  updateUser: vi.fn(),
  getUser: vi.fn(),
}

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

/** 서비스 롤 클라이언트 — 가입 여부 확인에만 쓴다. */
let adminRows: unknown[] = []
let adminUser: unknown = null
const getUserById = vi.fn(async () => ({ data: { user: adminUser }, error: null }))
const adminClient = {
  auth: { admin: { getUserById } },
  from: () => {
    const builder: Record<string, unknown> = {}
    for (const method of ['select', 'eq']) builder[method] = () => builder
    builder.limit = async () => ({ data: adminRows, error: null })
    return builder
  },
}
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminClient }))

const { completeSignup, sendSignupCode, verifySignupCode } =
  await import('@/lib/actions/signup-actions')

const USER = { id: 'aaaaaaaa-0000-4000-8000-000000000001' }

beforeEach(() => {
  vi.clearAllMocks()
  adminRows = []
  adminUser = null
  profileResult = { data: null, error: null }
  auth.signInWithOtp.mockResolvedValue({ data: {}, error: null })
  auth.verifyOtp.mockResolvedValue({ data: { user: USER, session: {} }, error: null })
  auth.updateUser.mockResolvedValue({ data: { user: USER }, error: null })
  auth.getUser.mockResolvedValue({ data: { user: USER }, error: null })
  getUserById.mockImplementation(async () => ({ data: { user: adminUser }, error: null }))
})

describe('sendSignupCode', () => {
  it('should reject a malformed address before sending anything', async () => {
    // Arrange & Act
    const result = await sendSignupCode('nope')

    // Assert
    expect(result.fieldErrors?.email).toBe('이메일 형식이 올바르지 않습니다.')
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('should refuse an address that already finished signing up', async () => {
    // Arrange — 프로필이 있고 Auth 쪽 메일 인증도 끝난 계정.
    adminRows = [{ id: USER.id, deleted_at: null, purged_at: null }]
    adminUser = { id: USER.id, email_confirmed_at: '2026-09-10T00:00:00.000Z' }

    // Act
    const result = await sendSignupCode('taken@glzaworld.co.kr')

    // Assert
    expect(result.fieldErrors?.email).toBe('이미 가입된 이메일입니다. 로그인해 주세요.')
    expect(auth.signInWithOtp).not.toHaveBeenCalled()
  })

  it('should treat a withdrawn-but-not-purged account as registered', async () => {
    // Arrange
    adminRows = [{ id: USER.id, deleted_at: '2026-09-01T00:00:00.000Z', purged_at: null }]

    // Act
    const result = await sendSignupCode('left@glzaworld.co.kr')

    // Assert — 다시 로그인하면 복구 화면으로 이어져야 한다. 새로 가입시키지 않는다.
    expect(result.fieldErrors?.email).toBe('이미 가입된 이메일입니다. 로그인해 주세요.')
  })

  it('should let an abandoned (unconfirmed) signup try again', async () => {
    // Arrange — 인증번호만 받고 그만둔 계정. 프로필 행은 이미 있다.
    adminRows = [{ id: USER.id, deleted_at: null, purged_at: null }]
    adminUser = { id: USER.id, email_confirmed_at: null }

    // Act
    const result = await sendSignupCode('pending@glzaworld.co.kr')

    // Assert
    expect(result.message).toBe('인증번호를 보냈습니다. 메일함을 확인해 주세요.')
    expect(auth.signInWithOtp).toHaveBeenCalledWith({
      email: 'pending@glzaworld.co.kr',
      options: { shouldCreateUser: true },
    })
  })

  it('should put a send failure under the email field in Korean', async () => {
    // Arrange
    auth.signInWithOtp.mockResolvedValue({
      data: null,
      error: { code: 'email_address_invalid', status: 400, message: 'Email address is invalid' },
    })

    // Act
    const result = await sendSignupCode('tester@stub.local')

    // Assert
    expect(result.fieldErrors?.email).toBe(
      '사용할 수 없는 이메일 주소입니다. 다른 주소를 입력해 주세요.',
    )
  })

  it('should translate the send rate limit', async () => {
    // Arrange
    auth.signInWithOtp.mockResolvedValue({
      data: null,
      error: { code: 'over_email_send_rate_limit', status: 429, message: 'rate limit' },
    })

    // Act
    const result = await sendSignupCode('tester@glzaworld.co.kr')

    // Assert
    expect(result.fieldErrors?.email).toBe(
      '인증번호 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
    )
  })
})

describe('verifySignupCode', () => {
  it('should require six digits', async () => {
    // Arrange & Act
    const result = await verifySignupCode('a@b.co', '123')

    // Assert
    expect(result.fieldErrors?.code).toBe('인증번호 6자리를 입력해 주세요.')
    expect(auth.verifyOtp).not.toHaveBeenCalled()
  })

  it('should verify with the email OTP type so both signup and magic-link codes work', async () => {
    // Arrange & Act
    const result = await verifySignupCode('  A@B.CO ', '01-23-45')

    // Assert
    expect(auth.verifyOtp).toHaveBeenCalledWith({
      email: 'a@b.co',
      token: '012345',
      type: 'email',
    })
    expect(result.message).toBe('이메일 인증이 완료되었습니다.')
  })

  it('should translate an expired code', async () => {
    // Arrange
    auth.verifyOtp.mockResolvedValue({
      data: { user: null },
      error: { code: 'otp_expired', status: 403, message: 'Token has expired or is invalid' },
    })

    // Act
    const result = await verifySignupCode('a@b.co', '012345')

    // Assert
    expect(result.fieldErrors?.code).toBe('인증번호가 올바르지 않거나 만료되었습니다.')
  })
})

describe('completeSignup', () => {
  it('should refuse a weak password', async () => {
    // Arrange & Act
    const result = await completeSignup('maple', 'maple')

    // Assert
    expect(result.fieldErrors?.password).toContain('영문과 숫자를 포함해')
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('should refuse a mismatch on the confirm field', async () => {
    // Arrange & Act
    const result = await completeSignup('maple1234', 'maple12345')

    // Assert
    expect(result.fieldErrors?.passwordConfirm).toBe('비밀번호가 일치하지 않습니다.')
  })

  it('should require the session created by the code step', async () => {
    // Arrange — 화면 상태가 아니라 세션이 유일한 근거다.
    auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const result = await completeSignup('maple1234', 'maple1234')

    // Assert
    expect(result.formError).toBe('인증 정보가 만료되었습니다. 처음부터 다시 진행해 주세요.')
    expect(auth.updateUser).not.toHaveBeenCalled()
  })

  it('should set the password and continue to onboarding', async () => {
    // Arrange
    profileResult = { data: null, error: null }

    // Act
    const promise = completeSignup('maple1234', 'maple1234', '/community')

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/auth/onboarding?next=${encodeURIComponent('/community')}`,
    )
    expect(auth.updateUser).toHaveBeenCalledWith({ password: 'maple1234' })
  })
})
