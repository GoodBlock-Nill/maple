import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `inviteAdminAction` — 관리자를 만드는 유일한 경로.
 *
 * 두 가지가 회귀하면 관리자 계정이 조용히 잘못 만들어진다.
 *   1) **순서**: `admin_invites` pending 행이 `inviteUserByEmail()` 보다 먼저여야 한다.
 *      메일 발송이 곧 `auth.users` insert 이고 그 순간 `handle_new_user()` 트리거가
 *      초대 행을 찾는다 — 뒤집히면 초대받은 사람이 일반 사용자로 만들어진다.
 *   2) **이미 있는 계정은 조용히 승격하지 않는다.** 승격은 "초대를 수락했다"는 사실이
 *      없는 권한 부여라, 나중에 그 사람이 어떻게 관리자가 됐는지 설명할 수 없다.
 */

const ACTOR_ID = '11111111-1111-4111-8111-111111111111'
const ROLE_ID = '33333333-3333-4333-8333-333333333333'
const INVITE_ID = '55555555-5555-4555-8555-555555555555'

type Call = { table: string; op: string; payload?: Record<string, unknown> }

const calls: Call[] = []

let profileRow: { id: string } | null = null
let roleRow: { id: string; key: string; name: string } | null = null
let inviteRow: { id: string; email: string; status: string } | null = null
let sendError: { message: string } | null = null

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }))

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
        insert: (payload: Record<string, unknown>) => {
          calls.push({ table, op: 'insert', payload })

          return builder
        },
        update: (payload: Record<string, unknown>) => {
          calls.push({ table, op: 'update', payload })

          return builder
        },
        maybeSingle: async () => ({ data: maybeSingleFor(table), error: null }),
        single: async () => ({ data: { id: INVITE_ID }, error: null }),
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
        inviteUserByEmail: async (email: string, options: { redirectTo?: string }) => {
          calls.push({ table: 'auth', op: 'inviteUserByEmail', payload: { email, ...options } })

          return { data: {}, error: sendError }
        },
      },
    },
  }),
}))

function maybeSingleFor(table: string): unknown {
  if (table === 'admin_roles') {
    return roleRow
  }

  if (table === 'profiles') {
    return profileRow
  }

  return inviteRow
}

const { inviteAdminAction } = await import('@/lib/actions/admin-invite-actions')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

function indexOf(table: string, op: string): number {
  return calls.findIndex((call) => call.table === table && call.op === op)
}

beforeEach(() => {
  calls.length = 0
  profileRow = null
  inviteRow = null
  sendError = null
  roleRow = { id: ROLE_ID, key: 'editor', name: '콘텐츠 편집자' }
  process.env.NEXT_PUBLIC_ADMIN_URL = 'https://maple-admin.vercel.app'
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('inviteAdminAction — 순서', () => {
  it('should write the pending invite before sending the email', async () => {
    // Act
    const result = await inviteAdminAction(
      {},
      formData({ email: 'new@good-block.com', roleId: ROLE_ID }),
    )

    // Assert
    expect(result.message).toContain('new@good-block.com')

    const inviteWrite = indexOf('admin_invites', 'insert')
    const mailSend = indexOf('auth', 'inviteUserByEmail')

    expect(inviteWrite).toBeGreaterThanOrEqual(0)
    expect(mailSend).toBeGreaterThanOrEqual(0)
    expect(inviteWrite).toBeLessThan(mailSend)
  })

  it('should carry the role and an expiry onto the invite row', async () => {
    await inviteAdminAction({}, formData({ email: 'new@good-block.com', roleId: ROLE_ID }))

    const payload = calls[indexOf('admin_invites', 'insert')]?.payload

    expect(payload?.role_id).toBe(ROLE_ID)
    expect(payload?.status).toBe('pending')
    expect(typeof payload?.expires_at).toBe('string')
    expect(Date.parse(String(payload?.expires_at))).toBeGreaterThan(Date.now())
  })

  it('should land the invitee on the accept page', async () => {
    await inviteAdminAction({}, formData({ email: 'new@good-block.com', roleId: ROLE_ID }))

    expect(calls[indexOf('auth', 'inviteUserByEmail')]?.payload?.redirectTo).toBe(
      'https://maple-admin.vercel.app/auth/callback?next=%2Finvite%2Faccept',
    )
  })

  it('should revoke the row again when the email cannot be sent', async () => {
    // Arrange
    sendError = { message: 'smtp is not configured' }

    // Act
    const result = await inviteAdminAction(
      {},
      formData({ email: 'new@good-block.com', roleId: ROLE_ID }),
    )

    // Assert — 메일이 안 나간 초대 행을 남기면 그 주소로 가입하는 누구나 관리자가 된다.
    expect(result.formError).toContain('초대는 취소되었습니다')
    expect(calls.at(-1)).toMatchObject({
      table: 'admin_invites',
      op: 'update',
      payload: { status: 'revoked' },
    })
  })
})

describe('inviteAdminAction — 이미 있는 계정', () => {
  it('should refuse instead of silently promoting', async () => {
    // Arrange
    profileRow = { id: 'existing-user' }

    // Act
    const result = await inviteAdminAction(
      {},
      formData({ email: 'nill@good-block.com', roleId: ROLE_ID }),
    )

    // Assert
    expect(result.formError).toBe(
      '이미 계정이 있는 이메일입니다. 관리자 목록에서 역할을 지정하거나 삭제 후 다시 초대해 주세요.',
    )
    expect(indexOf('auth', 'inviteUserByEmail')).toBe(-1)
    expect(indexOf('admin_invites', 'insert')).toBe(-1)
  })
})

describe('inviteAdminAction — 입력 검증', () => {
  it('should reject a malformed email before touching the database', async () => {
    const result = await inviteAdminAction({}, formData({ email: 'nope', roleId: ROLE_ID }))

    expect(result.fieldErrors?.email).toBeDefined()
    expect(calls).toHaveLength(0)
  })

  it('should reject a role that does not exist', async () => {
    roleRow = null

    const result = await inviteAdminAction(
      {},
      formData({ email: 'new@good-block.com', roleId: ROLE_ID }),
    )

    expect(result.fieldErrors?.roleId).toBe('역할을 찾을 수 없습니다.')
    expect(indexOf('auth', 'inviteUserByEmail')).toBe(-1)
  })
})
