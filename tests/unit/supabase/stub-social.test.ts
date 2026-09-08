import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** `server-only` 는 클라이언트 환경에서 import 되면 예외를 던진다. 테스트에서는 비운다. */
vi.mock('server-only', () => ({}))

type AdminStub = ReturnType<typeof createAdminStub>

let admin: AdminStub
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => admin }))

const { markStubProvider, signInWithStubProvider, stubDemoEmail } =
  await import('@/lib/supabase/stub-social')

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'

/** 서비스 롤 클라이언트 스텁. profiles 조회/갱신과 admin auth API 만 흉내 낸다. */
function createAdminStub(profileRow: { id: string } | null) {
  const updates: unknown[] = []

  const builder = {
    select: () => builder,
    eq: () => builder,
    maybeSingle: async () => ({ data: profileRow, error: null }),
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
  admin = createAdminStub({ id: USER_ID })
  // 실패 경로는 의도적으로 console.error 를 남긴다. 테스트 출력만 조용히 한다.
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('stubDemoEmail', () => {
  it('should namespace the demo account per provider', () => {
    // Arrange & Act & Assert — 실제로 메일을 보내지 않으므로 예약 TLD 를 쓴다.
    expect(stubDemoEmail('google')).toBe('demo-google@stub.maple.local')
    expect(stubDemoEmail('kakao')).toBe('demo-kakao@stub.maple.local')
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

  it('should fall back to a demo account when anonymous sign-in is disabled', async () => {
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
      email: 'demo-google@stub.maple.local',
    })
    expect(client.auth.verifyOtp).toHaveBeenCalledWith({
      token_hash: 'hashed-token',
      type: 'magiclink',
    })
  })

  it('should create the demo account when it does not exist yet', async () => {
    // Arrange
    admin = createAdminStub(null)
    const client = createServerStub()
    client.auth.signInAnonymously.mockResolvedValue({
      data: { user: null },
      error: ANONYMOUS_DISABLED,
    } as never)

    // Act
    const result = await signInWithStubProvider(client as never, 'kakao')

    // Assert
    expect(result.ok).toBe(true)
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith({
      email: 'demo-kakao@stub.maple.local',
      email_confirm: true,
      user_metadata: { provider: 'kakao', nickname: '카카오테스터' },
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
    admin = createAdminStub(null)
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
