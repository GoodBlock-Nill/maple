import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NOT_ADMIN_MESSAGE } from '@/lib/validation/auth'

/**
 * `/auth/callback` 의 role 게이트.
 *
 * 초대 링크와 비밀번호 재설정 메일이 이 착지점을 함께 쓴다. 재설정 메일은 관리자가
 * 아닌 계정도 받을 수 있으므로, 여기서 `profiles.role` 을 확인하지 않으면 비관리자가
 * 관리자 도메인의 세션 쿠키를 그대로 들고 다니게 된다 — 화면은 `requireAdmin()` 이
 * 막지만, 세션을 남긴 채 튕기는 상태는 그 자체로 버그다.
 */

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'

let profileRole: string | null = 'admin'
let exchangeError: { message: string } | null = null
let signOutCount = 0

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      exchangeCodeForSession: async () => ({
        data: exchangeError === null ? { user: { id: ADMIN_ID } } : { user: null },
        error: exchangeError,
      }),
      signOut: async () => {
        signOutCount += 1

        return { error: null }
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: profileRole === null ? null : { role: profileRole },
            error: null,
          }),
        }),
      }),
    }),
  }),
}))

const { GET } = await import('@/app/auth/callback/route')

function callbackRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost:3100/auth/callback${query}`)
}

beforeEach(() => {
  profileRole = 'admin'
  exchangeError = null
  signOutCount = 0
})

describe('GET /auth/callback', () => {
  it('should send an admin to the requested path', async () => {
    // Act
    const response = await GET(callbackRequest('?code=abc&next=%2Fmembers'))

    // Assert
    expect(response.headers.get('location')).toBe('http://localhost:3100/members')
    expect(signOutCount).toBe(0)
  })

  it('should sign out and bounce a member without the admin role', async () => {
    // Arrange
    profileRole = 'user'

    // Act
    const response = await GET(callbackRequest('?code=abc&next=%2Fmembers'))

    // Assert
    expect(response.headers.get('location')).toBe('http://localhost:3100/login?error=not_admin')
    expect(signOutCount).toBe(1)
  })

  it('should treat a missing profile row as not an admin', async () => {
    profileRole = null

    const response = await GET(callbackRequest('?code=abc'))

    expect(response.headers.get('location')).toBe('http://localhost:3100/login?error=not_admin')
    expect(signOutCount).toBe(1)
  })

  it('should not check the role when the code exchange failed', async () => {
    exchangeError = { message: 'invalid flow state' }

    const response = await GET(callbackRequest('?code=abc'))

    expect(response.headers.get('location')).toBe('http://localhost:3100/login?error=link_expired')
    expect(signOutCount).toBe(0)
  })

  it('should bounce the provider error response before touching supabase', async () => {
    const response = await GET(callbackRequest('?error=access_denied'))

    expect(response.headers.get('location')).toBe('http://localhost:3100/login?error=auth_failed')
  })

  it('should reject an external next path (open redirect)', async () => {
    const response = await GET(callbackRequest('?code=abc&next=https%3A%2F%2Fevil.example'))

    expect(response.headers.get('location')).toBe('http://localhost:3100/')
  })
})

describe('not_admin 안내 문구', () => {
  /* 관리자는 초대로만 만들어진다(2026-09-09 제품 결정). "회원 상세에서 권한 부여"로
     되돌아가면 받는 사람이 존재하지 않는 화면을 찾게 된다. */
  it('should tell the member to ask for an invite, not a promotion', () => {
    expect(NOT_ADMIN_MESSAGE).toContain('초대')
    expect(NOT_ADMIN_MESSAGE).not.toContain('회원 상세')
  })
})
