import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 관리자 삭제·역할 변경의 두 안전장치.
 *
 *   1) **자기 자신**은 바꾸거나 지울 수 없다. 실수로 스스로를 잠그면 복구에 서비스
 *      롤 스크립트가 필요하다.
 *   2) **마지막 슈퍼어드민**은 내리거나 지울 수 없다. 0 이 되는 순간 권한 체계를
 *      되돌릴 사람이 사라진다.
 *
 * 삭제가 role 만 내리는 게 아니라 auth 계정까지 정지시키는지도 함께 고정한다 —
 * role 만 내리면 이메일·비밀번호 로그인은 계속 성공하고 화면에서만 튕긴다.
 */

const ACTOR_ID = '11111111-1111-4111-8111-111111111111'
const TARGET_ID = '22222222-2222-4222-8222-222222222222'
const ROLE_ID = '33333333-3333-4333-8333-333333333333'

type Call = { table: string; op: string; payload?: Record<string, unknown> }

const calls: Call[] = []
const bans: { userId: string; duration: string | undefined }[] = []

let targetRow: Record<string, unknown> | null = null
let roleRow: { id: string; key: string; name: string } | null = null
let superAdminCount = 2

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }))
vi.mock('@/lib/data/admins', () => ({ countSuperAdmins: async () => superAdminCount }))

const ACTOR = {
  id: ACTOR_ID,
  email: 'admin@stub.local',
  nickname: '운영자',
  role: 'admin',
  roleKey: 'super_admin',
  roleName: '슈퍼어드민',
  permissions: { admins: 'write' },
  isSuperAdmin: true,
}

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ACTOR),
  requirePermission: vi.fn(async () => ACTOR),
  requireAnyPermission: vi.fn(async () => ACTOR),
  requireSuperAdmin: vi.fn(async () => ACTOR),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        ilike: () => builder,
        update: (payload: Record<string, unknown>) => {
          calls.push({ table, op: 'update', payload })

          return builder
        },
        maybeSingle: async () => ({
          data: table === 'admin_roles' ? roleRow : targetRow,
          error: null,
        }),
        then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
      }

      return builder
    },
  }),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    auth: {
      admin: {
        updateUserById: async (userId: string, attrs: { ban_duration?: string }) => {
          bans.push({ userId, duration: attrs.ban_duration })

          return { data: {}, error: null }
        },
      },
    },
  }),
}))

const { changeAdminRoleAction, deleteAdminAction } = await import('@/lib/actions/admin-actions')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

beforeEach(() => {
  calls.length = 0
  bans.length = 0
  superAdminCount = 2
  roleRow = { id: ROLE_ID, key: 'editor', name: '콘텐츠 편집자' }
  targetRow = {
    id: TARGET_ID,
    email: 'target@good-block.com',
    nickname: '대상',
    role: 'admin',
    admin_role_id: 'other-role',
    admin_roles: { key: 'editor' },
  }
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('deleteAdminAction', () => {
  it('should refuse to delete yourself', async () => {
    const result = await deleteAdminAction({}, formData({ adminId: ACTOR_ID }))

    expect(result.formError).toBe('자기 자신은 삭제할 수 없습니다.')
    expect(calls).toHaveLength(0)
    expect(bans).toHaveLength(0)
  })

  it('should refuse to delete the last super admin', async () => {
    targetRow = { ...targetRow, admin_roles: { key: 'super_admin' } }
    superAdminCount = 1

    const result = await deleteAdminAction({}, formData({ adminId: TARGET_ID }))

    expect(result.formError).toBe('마지막 슈퍼어드민입니다. 다른 슈퍼어드민을 먼저 지정해 주세요.')
    expect(calls).toHaveLength(0)
  })

  it('should allow deleting a super admin while another one remains', async () => {
    targetRow = { ...targetRow, admin_roles: { key: 'super_admin' } }
    superAdminCount = 2

    const result = await deleteAdminAction({}, formData({ adminId: TARGET_ID }))

    expect(result.message).toContain('삭제했습니다')
  })

  it('should drop the role, revoke invites and ban the auth user', async () => {
    const result = await deleteAdminAction({}, formData({ adminId: TARGET_ID }))

    expect(result.message).toBe('대상 관리자를 삭제했습니다.')
    expect(calls[0]).toMatchObject({
      table: 'profiles',
      op: 'update',
      payload: { role: 'user', admin_role_id: null },
    })
    expect(calls[1]).toMatchObject({
      table: 'admin_invites',
      op: 'update',
      payload: { status: 'revoked' },
    })
    // role 만 내리면 이메일·비밀번호 로그인은 계속 성공한다. 계정 자체를 잠근다.
    expect(bans).toEqual([{ userId: TARGET_ID, duration: '876600h' }])
  })

  it('should refuse a target that is not an admin', async () => {
    targetRow = { ...targetRow, role: 'user' }

    const result = await deleteAdminAction({}, formData({ adminId: TARGET_ID }))

    expect(result.formError).toBe('관리자를 찾을 수 없습니다.')
  })
})

describe('changeAdminRoleAction', () => {
  it('should refuse to change your own role', async () => {
    const result = await changeAdminRoleAction({}, formData({ adminId: ACTOR_ID, roleId: ROLE_ID }))

    expect(result.formError).toBe('자기 자신의 권한은 바꿀 수 없습니다.')
    expect(calls).toHaveLength(0)
  })

  it('should refuse to demote the last super admin', async () => {
    targetRow = { ...targetRow, admin_roles: { key: 'super_admin' } }
    superAdminCount = 1

    const result = await changeAdminRoleAction(
      {},
      formData({ adminId: TARGET_ID, roleId: ROLE_ID }),
    )

    expect(result.formError).toBe('마지막 슈퍼어드민입니다. 다른 슈퍼어드민을 먼저 지정해 주세요.')
    expect(calls).toHaveLength(0)
  })

  it('should let the last super admin keep the super admin role', async () => {
    targetRow = { ...targetRow, admin_roles: { key: 'super_admin' } }
    roleRow = { id: ROLE_ID, key: 'super_admin', name: '슈퍼어드민' }
    superAdminCount = 1

    const result = await changeAdminRoleAction(
      {},
      formData({ adminId: TARGET_ID, roleId: ROLE_ID }),
    )

    expect(result.message).toContain('슈퍼어드민')
  })

  it('should write the new role id', async () => {
    const result = await changeAdminRoleAction(
      {},
      formData({ adminId: TARGET_ID, roleId: ROLE_ID }),
    )

    expect(result.message).toBe('대상 님의 역할을 콘텐츠 편집자 로 바꿨습니다.')
    expect(calls[0]).toMatchObject({
      table: 'profiles',
      op: 'update',
      payload: { admin_role_id: ROLE_ID },
    })
  })

  it('should say so when the role is already applied', async () => {
    targetRow = { ...targetRow, admin_role_id: ROLE_ID }

    const result = await changeAdminRoleAction(
      {},
      formData({ adminId: TARGET_ID, roleId: ROLE_ID }),
    )

    expect(result.formError).toBe('이미 같은 역할입니다.')
    expect(calls).toHaveLength(0)
  })
})
