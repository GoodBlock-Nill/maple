import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { SOCIAL_LOGIN_NAVER_MESSAGE, SOCIAL_LOGIN_STUB_MESSAGE } from '@/lib/validation/auth'

/**
 * `socialSignInAction` — 관리자 간편로그인의 시작점.
 *
 * 세 가지가 회귀하면 곤란하다.
 *   1) 실 OAuth 전(`stub`)에는 **절대 로그인시키지 않는다**. 사용자 사이트의
 *      스텁을 그대로 옮기면 아무나 관리자 후보 계정을 만들 수 있다.
 *   2) 네이버는 Supabase 기본 제공자가 아니라 `oauth` 모드에서도 안내만 준다.
 *   3) `redirectTo` 는 **관리자 도메인**의 콜백이어야 한다 — 사용자 사이트로
 *      돌아가면 세션이 엉뚱한 앱에 심긴다. `next` 는 오픈 리다이렉트를 막기 위해
 *      내부 경로로 좁힌 뒤 인코딩해 싣는다.
 */

const redirectCalls: string[] = []

/* `redirect()` 는 예외를 던져 흐름을 끊는다. 실제 구현을 부르면 Next 런타임이
   필요하므로 같은 "던지는" 계약만 흉내 낸다. */
vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectCalls.push(url)

    throw new Error('NEXT_REDIRECT')
  },
}))

type OAuthResult = { data: { url: string | null }; error: { message: string } | null }

const oauthCalls: { provider: string; options?: { redirectTo?: string } }[] = []

let oauthResult: OAuthResult = {
  data: { url: 'https://project.supabase.co/auth/v1/authorize?provider=google' },
  error: null,
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      signInWithOAuth: async (params: { provider: string; options?: { redirectTo?: string } }) => {
        oauthCalls.push(params)

        return oauthResult
      },
    },
  }),
}))

const { socialSignInAction, socialSignInFormAction } = await import('@/lib/actions/auth-actions')

const PROVIDER_URL = 'https://project.supabase.co/auth/v1/authorize?provider=google'

beforeEach(() => {
  redirectCalls.length = 0
  oauthCalls.length = 0
  oauthResult = { data: { url: PROVIDER_URL }, error: null }
  process.env.NEXT_PUBLIC_ADMIN_URL = 'https://maple-admin.vercel.app'
})

afterEach(() => {
  delete process.env.SOCIAL_LOGIN_MODE
  delete process.env.NEXT_PUBLIC_ADMIN_URL
  vi.restoreAllMocks()
})

describe('socialSignInAction — stub 모드', () => {
  it('should refuse to sign in and point at the password form', async () => {
    // Arrange — 값이 없으면 stub 이다(사용자 사이트와 같은 규칙).
    delete process.env.SOCIAL_LOGIN_MODE

    // Act
    const result = await socialSignInAction('google', '/members')

    // Assert
    expect(result.formError).toBe(SOCIAL_LOGIN_STUB_MESSAGE)
    expect(oauthCalls).toHaveLength(0)
    expect(redirectCalls).toHaveLength(0)
  })

  it('should treat an unknown mode value as stub', async () => {
    process.env.SOCIAL_LOGIN_MODE = 'yes-please'

    expect((await socialSignInAction('kakao')).formError).toBe(SOCIAL_LOGIN_STUB_MESSAGE)
  })

  it('should reject an unknown provider before looking at the mode', async () => {
    process.env.SOCIAL_LOGIN_MODE = 'oauth'

    const result = await socialSignInAction('facebook', '/')

    expect(result.formError).toBe('지원하지 않는 로그인 방식입니다.')
    expect(oauthCalls).toHaveLength(0)
  })
})

describe('socialSignInAction — oauth 모드', () => {
  beforeEach(() => {
    process.env.SOCIAL_LOGIN_MODE = 'oauth'
  })

  it('should explain that naver is not wired yet instead of calling supabase', async () => {
    // Act
    const result = await socialSignInAction('naver', '/members')

    // Assert
    expect(result.formError).toBe(SOCIAL_LOGIN_NAVER_MESSAGE)
    expect(oauthCalls).toHaveLength(0)
  })

  it('should send the admin callback as redirectTo and redirect to the provider', async () => {
    // Act — redirect() 가 던지므로 여기서 흐름이 끊긴다.
    await expect(socialSignInAction('google', '/members?page=2')).rejects.toThrow('NEXT_REDIRECT')

    // Assert
    expect(oauthCalls).toHaveLength(1)
    expect(oauthCalls[0]?.provider).toBe('google')
    expect(oauthCalls[0]?.options?.redirectTo).toBe(
      'https://maple-admin.vercel.app/auth/callback?next=%2Fmembers%3Fpage%3D2',
    )
    expect(redirectCalls).toEqual([PROVIDER_URL])
  })

  it('should sanitise an external next before putting it on the callback URL', async () => {
    await expect(socialSignInAction('kakao', 'https://evil.example')).rejects.toThrow(
      'NEXT_REDIRECT',
    )

    expect(oauthCalls[0]?.provider).toBe('kakao')
    expect(oauthCalls[0]?.options?.redirectTo).toBe(
      'https://maple-admin.vercel.app/auth/callback?next=%2F',
    )
  })

  it('should return a generic message when supabase refuses to start the flow', async () => {
    // Arrange
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    oauthResult = { data: { url: null }, error: { message: 'provider is not enabled' } }

    // Act
    const result = await socialSignInAction('google', '/')

    // Assert — 제공자 설정 오류를 화면에 그대로 노출하지 않는다.
    expect(result.formError).toBe('간편로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(redirectCalls).toHaveLength(0)
  })
})

describe('socialSignInFormAction', () => {
  it('should read provider and next from the submitted form', async () => {
    // Arrange
    process.env.SOCIAL_LOGIN_MODE = 'oauth'
    const formData = new FormData()
    formData.set('provider', 'google')
    formData.set('next', '/audit')

    // Act
    await expect(socialSignInFormAction({}, formData)).rejects.toThrow('NEXT_REDIRECT')

    // Assert
    expect(oauthCalls[0]?.options?.redirectTo).toBe(
      'https://maple-admin.vercel.app/auth/callback?next=%2Faudit',
    )
  })

  it('should fall back to the stub message when no button value arrived', async () => {
    delete process.env.SOCIAL_LOGIN_MODE

    const result = await socialSignInFormAction({}, new FormData())

    expect(result.formError).toBe('지원하지 않는 로그인 방식입니다.')
  })
})
