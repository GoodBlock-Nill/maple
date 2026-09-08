import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** `server-only` 는 클라이언트 환경에서 import 되면 예외를 던진다. 테스트에서는 비운다. */
vi.mock('server-only', () => ({}))

type AdminStub = ReturnType<typeof createAdminStub>

let admin: AdminStub
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))

const { freshStubEmail, markStubProvider, signInWithStubProvider, STUB_EMAIL_DOMAIN } =
  await import('@/lib/supabase/stub-social')

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'

/** 서비스 롤 클라이언트 스텁. profiles 갱신과 admin auth API 만 흉내 낸다. */
function createAdminStub() {
  const updates: unknown[] = []

  const builder = {
    update: (payload: unknown) => {
      updates.push(payload)

      return { eq: async () => ({ data: null, error: null }) }
    },
  }

  return {
    updates,
    from: () => builder,
    auth: {
      admin: {
        createUser: vi.fn(async () => ({ data: { user: { id: USER_ID } }, error: null })),
        generateLink: vi.fn(async () => ({
          data: { properties: { hashed_token: 'hashed-token' } },
          error: null,
        })),
        updateUserById: vi.fn(async () => ({ data: { user: { id: USER_ID } }, error: null })),
      },
    },
  }
}

/** 쿠키를 아는 서버 클라이언트 스텁. 세션을 심는 메서드만 있으면 된다. */
function createServerStub() {
  return {
    auth: {
      signInAnonymously: vi.fn(async () => ({
        data: { user: { id: USER_ID } },
        error: null,
      })),
      verifyOtp: vi.fn(async () => ({ data: {}, error: null })),
      signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
    },
  }
}

const ANONYMOUS_DISABLED = { message: 'Anonymous sign-ins are disabled', status: 422 }

beforeEach(() => {
  admin = createAdminStub()
  // 실패 경로는 의도적으로 console.error 를 남긴다. 테스트 출력만 조용히 한다.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('freshStubEmail', () => {
  it('should namespace the address by provider and the reserved TLD', () => {
    // Arrange & Act & Assert — 실제로 메일을 보내지 않으므로 예약 TLD 를 쓴다.
    expect(freshStubEmail('google')).toMatch(
      new RegExp(`^stub-google-[0-9a-f-]{36}@${STUB_EMAIL_DOMAIN.replaceAll('.', '\\.')}$`),
    )
  })

  it('should generate a unique email on every call — never reuse an existing stub user', () => {
    // Arrange & Act
    const first = freshStubEmail('kakao')
    const second = freshStubEmail('kakao')

    // Assert — 프로덕션 버그(2026-09-08): 고정 이메일을 재사용하면 이미 온보딩을
    // 마친 계정으로 로그인돼 약관 동의·필수 입력이 통째로 스킵됐다.
    expect(first).not.toBe(second)
  })
})

describe('signInWithStubProvider', () => {
  it('should prefer anonymous sign-in so every tester gets their own account', async () => {
    // Arrange
    const client = createServerStub()

    // Act
    const result = await signInWithStubProvider(client as never, 'kakao')

    // Assert
    expect(result).toEqual({ ok: true, userId: USER_ID, isAnonymous: true })
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled()
  })

  it('should pass the provider and nickname so the trigger can seed the profile', async () => {
    // Arrange
    const client = createServerStub()

    // Act
    await signInWithStubProvider(client as never, 'naver')

    // Assert — role 은 절대 싣지 않는다(권한 상승 방지).
    expect(client.auth.signInAnonymously).toHaveBeenCalledWith({
      options: { data: { provider: 'naver', nickname: '네이버테스터' } },
    })
  })

  it('should fall back to a freshly created account when anonymous sign-in is disabled', async () => {
    // Arrange
    const client = createServerStub()
    client.auth.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: ANONYMOUS_DISABLED,
    } as never)

    // Act
    const result = await signInWithStubProvider(client as never, 'google')

    // Assert
    expect(result).toEqual({ ok: true, userId: USER_ID, isAnonymous: false })
    expect(admin.auth.admin.generateLink).toHaveBeenCalledWith({
      type: 'magiclink',
      email: expect.stringMatching(new RegExp(`^stub-google-.+@${STUB_EMAIL_DOMAIN}$`)),
    })
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'hashed-token',
      type: 'magiclink',
    })
  })

  it('should always create a brand new account instead of reusing an existing stub user', async () => {
    // Arrange — 프로덕션 버그(2026-09-08): 예전에는 기존 계정을 찾아서 재사용했다.
    // 그 계정이 이미 온보딩을 마쳤다면 이후 로그인마다 온보딩이 통째로 스킵됐다.
    const client = createServerStub()
    client.auth.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: ANONYMOUS_DISABLED,
    } as never)

    // Act
    await signInWithStubProvider(client as never, 'kakao')
    await signInWithStubProvider(client as never, 'kakao')

    // Assert — 조회 없이, 호출할 때마다 새 계정을 만든다.
    expect(admin.auth.admin.createUser).toHaveBeenCalledTimes(2)
    type CreateUserArgs = {
      email: string
      email_confirm: boolean
      user_metadata: Record<string, unknown>
    }
    const calls = admin.auth.admin.createUser.mock.calls as unknown as [CreateUserArgs][]
    const [firstCall] = calls[0] ?? []
    const [secondCall] = calls[1] ?? []
    expect(firstCall?.email).not.toBe(secondCall?.email)
    expect(firstCall?.email_confirm).toBe(true)
    expect(firstCall?.user_metadata).toEqual({
      provider: 'kakao',
      nickname: '카카오테스터',
      stub: true,
    })
  })

  it('should fall back to a temporary password when the magic link is rate limited', async () => {
    // Arrange
    const client = createServerStub()
    client.auth.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: ANONYMOUS_DISABLED,
    } as never)
    admin.auth.admin.generateLink.mockResolvedValue({
      data: null,
      error: { message: 'For security purposes, you can only request this after 60 seconds' },
    } as never)

    // Act
    const result = await signInWithStubProvider(client as never, 'google')

    // Assert
    expect(result.ok).toBe(true)
    expect(admin.auth.admin.updateUserById).toHaveBeenCalled()
    expect(client.auth.signInWithPassword).toHaveBeenCalled()
  })

  it('should never leak a token in the failure message', async () => {
    // Arrange — 모든 경로가 막힌 상황.
    admin.auth.admin.createUser.mockResolvedValue({
      data: { user: null },
      error: { message: 'boom' },
    } as never)
    const client = createServerStub()
    client.auth.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: ANONYMOUS_DISABLED,
    } as never)

    // Act
    const result = await signInWithStubProvider(client as never, 'naver')

    // Assert
    expect(result).toEqual({
      ok: false,
      message: '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.',
    })
  })
})

describe('markStubProvider', () => {
  it('should record the pressed button with a unique identity', async () => {
    // Arrange & Act
    await markStubProvider(USER_ID, 'kakao')

    // Assert — provider_id 에는 (provider, provider_id) 유니크 제약이 걸려 있다.
    expect(admin.updates).toEqual([{ provider: 'kakao', provider_id: `stub:${USER_ID}` }])
  })
})
