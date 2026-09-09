import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `requirePermission()` · `requireSuperAdmin()` 의 리다이렉트 계약.
 *
 * 세 가지가 회귀하면 곤란하다.
 *   1) 권한이 없으면 **로그아웃시키지 않는다.** 계정은 정상이고 이 화면만 닫혀 있을
 *      뿐이라, 세션을 끊으면 쓸 수 있는 화면까지 함께 잃는다.
 *   2) 착지점은 대시보드(`/?error=forbidden`)다 — 거기서 사유를 배너로 알린다.
 *   3) 역할이 없는 관리자는 **아무 모듈도 못 본다**(닫힘 실패). 기본값이 열려 있으면
 *      역할 삭제 사고가 곧 권한 상승이 된다.
 */

const USER_ID = '11111111-1111-4111-8111-111111111111'

const redirectCalls: string[] = []
let signOutCount = 0

type RoleRow = { key: string; name: string; permissions: unknown } | null

let profile: {
  nickname: string
  role: string
  admin_role_id: string | null
  admin_roles: RoleRow
} | null = null

vi.mock('server-only', () => ({}))

vi.mock('next/navigation', () => ({
  redirect: (url: string) => {
    redirectCalls.push(url)

    throw new Error('NEXT_REDIRECT')
  },
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID, email: 'admin@stub.local' } } }),
      signOut: async () => {
        signOutCount += 1

        return { error: null }
      },
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: profile, error: null }),
        }),
      }),
    }),
  }),
}))

const { requireAdmin, requireAnyPermission, requirePermission, requireSuperAdmin } =
  await import('@/lib/auth/require-admin')

function withRole(key: string, permissions: Record<string, string>): void {
  profile = {
    nickname: '운영자',
    role: 'admin',
    admin_role_id: 'role-id',
    admin_roles: { key, name: key === 'super_admin' ? '슈퍼어드민' : '콘텐츠 편집자', permissions },
  }
}

beforeEach(() => {
  redirectCalls.length = 0
  signOutCount = 0
  withRole('editor', { news: 'write', members: 'read' })
})

describe('requireAdmin', () => {
  it('should expose the role and its parsed permissions', async () => {
    const admin = await requireAdmin()

    expect(admin.roleKey).toBe('editor')
    expect(admin.roleName).toBe('콘텐츠 편집자')
    expect(admin.permissions).toEqual({ news: 'write', members: 'read' })
    expect(admin.isSuperAdmin).toBe(false)
  })

  it('should treat an admin without a role as having no permissions', async () => {
    profile = { nickname: '운영자', role: 'admin', admin_role_id: null, admin_roles: null }

    const admin = await requireAdmin()

    expect(admin.roleKey).toBeNull()
    expect(admin.permissions).toEqual({})
    expect(admin.isSuperAdmin).toBe(false)
  })

  it('should sign out and bounce a profile without the admin role', async () => {
    profile = { nickname: '유저', role: 'user', admin_role_id: null, admin_roles: null }

    await expect(requireAdmin()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectCalls).toEqual(['/login?error=not_admin'])
    expect(signOutCount).toBe(1)
  })
})

describe('requirePermission', () => {
  it('should pass when the level is satisfied', async () => {
    await expect(requirePermission('news', 'write')).resolves.toMatchObject({ roleKey: 'editor' })
    expect(redirectCalls).toHaveLength(0)
  })

  it('should pass read when the role has write', async () => {
    await expect(requirePermission('news', 'read')).resolves.toMatchObject({ roleKey: 'editor' })
  })

  it('should send a read-only role away from a write screen', async () => {
    await expect(requirePermission('members', 'write')).rejects.toThrow('NEXT_REDIRECT')

    expect(redirectCalls).toEqual(['/?error=forbidden'])
    // 권한이 없다고 세션을 끊지 않는다 — 쓸 수 있는 화면까지 함께 잃는다.
    expect(signOutCount).toBe(0)
  })

  it('should close a module the role never mentions', async () => {
    await expect(requirePermission('settings', 'read')).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectCalls).toEqual(['/?error=forbidden'])
  })
})

describe('requireAnyPermission', () => {
  it('should pass when one of the modules qualifies', async () => {
    withRole('moderator', { reports: 'write' })

    await expect(requireAnyPermission(['community', 'reports'], 'write')).resolves.toMatchObject({
      roleKey: 'moderator',
    })
  })

  it('should redirect when none qualifies', async () => {
    await expect(requireAnyPermission(['community', 'reports'], 'write')).rejects.toThrow(
      'NEXT_REDIRECT',
    )
    expect(redirectCalls).toEqual(['/?error=forbidden'])
  })
})

describe('requireSuperAdmin', () => {
  it('should refuse a role that merely has admins write', async () => {
    withRole('helper', { admins: 'write' })

    await expect(requireSuperAdmin()).rejects.toThrow('NEXT_REDIRECT')
    expect(redirectCalls).toEqual(['/?error=forbidden'])
  })

  it('should pass the system super_admin role', async () => {
    withRole('super_admin', { admins: 'write' })

    await expect(requireSuperAdmin()).resolves.toMatchObject({ isSuperAdmin: true })
  })
})
