import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 강제 탈퇴 · 개인정보 즉시 파기의 가드.
 *
 * 두 액션 모두 UI 없이 직접 POST 로 부를 수 있고, 파기는 되돌릴 수 없다. 넷을 고정한다.
 * 슈퍼어드민 전용 · 자기 자신 금지 · 상태 전이(탈퇴했고 아직 파기 전) · 지우는 필드가
 * 배치 함수(`purge_withdrawn_profiles`)와 같을 것. 마지막이 어긋나면 관리자 경로로
 * 지운 계정에만 개인정보가 남는다.
 */

const ACTOR_ID = '11111111-1111-4111-8111-111111111111'
const TARGET_ID = '22222222-2222-4222-8222-222222222222'

const RAW_ERROR = 'permission denied for table profiles (policy "profiles_update_admin")'

type Call = {
  client: 'session' | 'service'
  table: string
  op: string
  payload?: Record<string, unknown>
}

const calls: Call[] = []
const deletedUsers: string[] = []
const audits: { actorId: string; action: string; targetId?: string }[] = []

let isSuperAdmin = true
let targetRow: Record<string, unknown> | null = null
let updateError: { message: string; code?: string } | null = null
let authError: { message: string } | null = null

const ACTOR = {
  id: ACTOR_ID,
  email: 'admin@stub.local',
  nickname: '운영자',
  role: 'admin',
  roleKey: 'super_admin',
  roleName: '슈퍼어드민',
  permissions: { members: 'write' },
  isSuperAdmin: true,
}

vi.mock('server-only', () => ({}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/revalidate', () => ({
  CLIENT_CACHE_TAGS: { communityList: 'community-list' },
  revalidateClient: vi.fn(async () => ({ ok: true })),
}))
vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(async (actorId: string, entry: { action: string; targetId?: string }) => {
    audits.push({ actorId, action: entry.action, targetId: entry.targetId })
  }),
}))

/* `requireSuperAdmin()` 은 권한이 없으면 `redirect()` 로 던진다. 테스트에서는 같은
   모양(예외)으로 흉내 내 "액션이 결과를 돌려주지 않는다"를 확인한다. */
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ACTOR),
  requirePermission: vi.fn(async () => ACTOR),
  requireAnyPermission: vi.fn(async () => ACTOR),
  requireSuperAdmin: vi.fn(async () => {
    if (!isSuperAdmin) {
      throw new Error('NEXT_REDIRECT')
    }

    return ACTOR
  }),
}))

function makeClient(client: 'session' | 'service') {
  return {
    from(table: string) {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: targetRow, error: null }),
        update: (payload: Record<string, unknown>) => {
          calls.push({ client, table, op: 'update', payload })

          return builder
        },
        then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: updateError }),
      }

      return builder
    },
  }
}

vi.mock('@/lib/supabase/server', () => ({ createClient: async () => makeClient('session') }))
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    ...makeClient('service'),
    auth: {
      admin: {
        deleteUser: async (userId: string) => {
          if (authError === null) {
            deletedUsers.push(userId)
          }

          return { data: {}, error: authError }
        },
      },
    },
  }),
}))

const { forceWithdrawMemberAction, purgeMemberNowAction } =
  await import('@/lib/actions/member-lifecycle-actions')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

function withdrawnRow(overrides: Record<string, unknown> = {}) {
  return {
    id: TARGET_ID,
    nickname: '모험가',
    email: 'member@example.com',
    avatar_url: null,
    role: 'user',
    suspended_until: null,
    suspension_reason: null,
    msw_uid: '1234567890',
    msw_profile_code: '#abcd12',
    deleted_at: '2026-06-01T00:00:00.000Z',
    purged_at: null,
    ...overrides,
  }
}

function updatesFrom(client: 'session' | 'service', table: string): Call[] {
  return calls.filter((call) => call.client === client && call.table === table)
}

beforeEach(() => {
  calls.length = 0
  deletedUsers.length = 0
  audits.length = 0
  isSuperAdmin = true
  updateError = null
  authError = null
  targetRow = withdrawnRow()
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('purgeMemberNowAction — 가드', () => {
  it('should refuse anyone who is not a super admin', async () => {
    isSuperAdmin = false

    await expect(purgeMemberNowAction({}, formData({ memberId: TARGET_ID }))).rejects.toThrow(
      'NEXT_REDIRECT',
    )
    expect(calls).toHaveLength(0)
  })

  it('should refuse to purge yourself', async () => {
    const result = await purgeMemberNowAction({}, formData({ memberId: ACTOR_ID }))

    expect(result.formError).toBe('자기 자신의 개인정보는 이 화면에서 파기할 수 없습니다.')
    expect(updatesFrom('service', 'profiles')).toHaveLength(0)
  })

  it('should reject a target that is not a uuid or does not exist', async () => {
    const invalid = await purgeMemberNowAction({}, formData({ memberId: 'nope' }))

    expect(invalid.fieldErrors?.memberId).toBeDefined()

    targetRow = null
    const missing = await purgeMemberNowAction({}, formData({ memberId: TARGET_ID }))

    expect(missing.formError).toBe('회원을 찾을 수 없습니다.')
  })

  it('should refuse a member who has not withdrawn', async () => {
    targetRow = withdrawnRow({ deleted_at: null })

    const result = await purgeMemberNowAction({}, formData({ memberId: TARGET_ID }))

    expect(result.formError).toBe(
      '탈퇴하지 않은 회원입니다. 먼저 탈퇴 처리를 한 뒤에 파기할 수 있습니다.',
    )
    expect(deletedUsers).toHaveLength(0)
  })

  it('should refuse a member who is already purged', async () => {
    targetRow = withdrawnRow({ purged_at: '2026-09-01T00:00:00.000Z' })

    const result = await purgeMemberNowAction({}, formData({ memberId: TARGET_ID }))

    expect(result.formError).toBe('이미 개인정보가 파기된 회원입니다. 더 지울 것이 없습니다.')
    expect(updatesFrom('service', 'profiles')).toHaveLength(0)
  })
})

describe('purgeMemberNowAction — 파기', () => {
  const ANONYMIZED = `탈퇴한 회원#${TARGET_ID.slice(0, 8)}`

  it('should clear the same fields as the batch function', async () => {
    const result = await purgeMemberNowAction({}, formData({ memberId: TARGET_ID }))

    expect(result.message).toBe('모험가 님의 개인정보를 파기했습니다.')

    const [update] = updatesFrom('service', 'profiles')

    expect(update?.payload).toMatchObject({
      email: null,
      nickname: ANONYMIZED,
      avatar_url: null,
      provider_id: null,
      msw_uid: null,
      msw_profile_code: null,
      suspended_until: null,
      suspension_reason: null,
    })
    expect(update?.payload?.purged_at).toEqual(expect.any(String))
  })

  it('should rename the author snapshots and delete the auth user', async () => {
    await purgeMemberNowAction({}, formData({ memberId: TARGET_ID }))

    // 공개 조회는 profiles 를 읽지 못한다. 이 스냅샷이 게시판 표시의 유일한 근거다.
    expect(updatesFrom('service', 'posts')[0]?.payload).toEqual({ author_name: ANONYMIZED })
    expect(updatesFrom('service', 'comments')[0]?.payload).toEqual({ author_name: ANONYMIZED })
    expect(deletedUsers).toEqual([TARGET_ID])
    expect(audits).toEqual([{ actorId: ACTOR_ID, action: 'member.purge', targetId: TARGET_ID }])
  })

  it('should roll purged_at back when the auth account survives', async () => {
    authError = { message: 'auth service unavailable' }

    const result = await purgeMemberNowAction({}, formData({ memberId: TARGET_ID }))

    expect(result.formError).toBe(
      '개인정보를 파기하지 못했습니다. 계정은 그대로입니다. 잠시 후 다시 시도해 주세요.',
    )
    // 마지막 프로필 쓰기가 purged_at 을 비운다 — 다음 배치가 이 회원을 다시 집어 간다.
    expect(updatesFrom('service', 'profiles').at(-1)?.payload).toEqual({ purged_at: null })
    expect(audits).toHaveLength(0)
  })

  it('should keep the raw postgres message out of the form error', async () => {
    updateError = { message: RAW_ERROR, code: '42501' }

    const result = await purgeMemberNowAction({}, formData({ memberId: TARGET_ID }))

    expect(result.formError).not.toContain(RAW_ERROR)
    expect(result.formError).not.toContain('policy')
  })
})

describe('forceWithdrawMemberAction', () => {
  beforeEach(() => {
    targetRow = withdrawnRow({ deleted_at: null })
  })

  it('should refuse to withdraw yourself', async () => {
    const result = await forceWithdrawMemberAction({}, formData({ memberId: ACTOR_ID }))

    expect(result.formError).toBe('자기 자신을 탈퇴 처리할 수는 없습니다.')
    expect(calls).toHaveLength(0)
  })

  it('should refuse an administrator account', async () => {
    targetRow = withdrawnRow({ deleted_at: null, role: 'admin' })

    const result = await forceWithdrawMemberAction({}, formData({ memberId: TARGET_ID }))

    expect(result.formError).toBe(
      '관리자 계정은 탈퇴 처리할 수 없습니다. 먼저 관리자 권한을 회수해 주세요.',
    )
  })

  it('should refuse a member who already left', async () => {
    targetRow = withdrawnRow()
    const withdrawn = await forceWithdrawMemberAction({}, formData({ memberId: TARGET_ID }))

    expect(withdrawn.formError).toBe('이미 탈퇴 상태인 회원입니다.')

    targetRow = withdrawnRow({ purged_at: '2026-09-01T00:00:00.000Z' })
    const purged = await forceWithdrawMemberAction({}, formData({ memberId: TARGET_ID }))

    expect(purged.formError).toBe('이미 개인정보가 파기된 회원입니다.')
  })

  it('should set deleted_at through the session client and audit it', async () => {
    const result = await forceWithdrawMemberAction({}, formData({ memberId: TARGET_ID }))

    expect(result.message).toBe('모험가 님을 탈퇴 상태로 전환했습니다.')

    const [update] = updatesFrom('session', 'profiles')

    expect(update?.payload?.deleted_at).toEqual(expect.any(String))
    // 서비스 롤은 쓰지 않는다 — 그러면 DB 트리거의 member.withdraw 행위자가 비어 버린다.
    expect(updatesFrom('service', 'profiles')).toHaveLength(0)
    expect(audits).toEqual([
      { actorId: ACTOR_ID, action: 'member.force_withdraw', targetId: TARGET_ID },
    ])
  })

  it('should keep the suspension untouched so it survives a restore', async () => {
    targetRow = withdrawnRow({ deleted_at: null, suspended_until: '2027-01-01T00:00:00.000Z' })

    await forceWithdrawMemberAction({}, formData({ memberId: TARGET_ID }))

    expect(updatesFrom('session', 'profiles')[0]?.payload).not.toHaveProperty('suspended_until')
  })

  it('should keep the raw postgres message out of the form error', async () => {
    updateError = { message: RAW_ERROR, code: '42501' }

    const result = await forceWithdrawMemberAction({}, formData({ memberId: TARGET_ID }))

    expect(result.formError).toBe(
      '회원을 탈퇴 처리하지 못했습니다. 계정은 그대로입니다. 잠시 후 다시 시도해 주세요.',
    )
    expect(result.formError).not.toContain(RAW_ERROR)
  })
})
