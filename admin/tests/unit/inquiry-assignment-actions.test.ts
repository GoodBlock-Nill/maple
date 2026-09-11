import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 담당자 배정 · 작성 중 잠금 액션.
 *
 * 고정하려는 것은 다섯이다.
 *   1. 모든 액션이 스스로 `requirePermission('inquiries', 'write')` 을 부른다 —
 *      서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출된다.
 *   2. 관리자가 아닌 계정은 담당자가 될 수 없다(select 에 없는 id 를 직접 보내도).
 *   3. 미배정 + '접수 대기' 문의를 맡으면 상태가 '처리 중'으로 함께 간다.
 *   4. 배정 해제는 상태를 건드리지 않는다.
 *   5. 잠금은 **가로챌 때만** 감사 로그를 남긴다 — 하트비트까지 적으면 1분에 한 줄씩
 *      쌓여 로그가 못 쓰게 된다.
 */

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ADMIN_ID = '22222222-2222-4222-8222-222222222222'
const INQUIRY_ID = '33333333-3333-4333-8333-333333333333'

const ACTOR = {
  id: ADMIN_ID,
  email: 'admin@stub.local',
  nickname: '운영자',
  role: 'admin',
  roleKey: 'super_admin',
  roleName: '슈퍼어드민',
  permissions: { inquiries: 'write' },
  isSuperAdmin: true,
}

const LEVEL_RANK: Record<string, number> = { none: 0, read: 1, write: 2 }

/** 테스트가 조절하는 현재 관리자의 권한. 기본은 쓰기. */
const granted = { inquiries: 'write' }
const guardCalls: [string, string][] = []

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ACTOR),
  requireAnyPermission: vi.fn(async () => ACTOR),
  requireSuperAdmin: vi.fn(async () => ACTOR),
  requirePermission: vi.fn(async (module: string, level: string) => {
    guardCalls.push([module, level])

    if ((LEVEL_RANK[granted.inquiries] ?? 0) < (LEVEL_RANK[level] ?? 0)) {
      // requirePermission 은 redirect() 로 빠져나간다. 그것은 예외를 던지는 것과 같다.
      throw new Error('NEXT_REDIRECT')
    }

    return ACTOR
  }),
}))

const audits: { action: string; before?: unknown; after?: unknown }[] = []

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(async (_actorId: string, entry: Record<string, unknown>) => {
    audits.push(entry as { action: string })
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

type Row = Record<string, unknown> | null

const db = vi.hoisted(() => ({
  inquiry: null as Record<string, unknown> | null,
  profile: null as Record<string, unknown> | null,
  updates: [] as { table: string; payload: Record<string, unknown> }[],
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  rpcResult: {} as Record<string, unknown>,
}))

vi.mock('@/lib/supabase/server', () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: (payload: Record<string, unknown>) => {
        db.updates.push({ table, payload })

        return chain
      },
      eq: () => chain,
      maybeSingle: async () => ({
        data: (table === 'profiles' ? db.profile : db.inquiry) as Row,
        error: null,
      }),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
    }

    return chain
  }

  return {
    createClient: async () => ({
      from: (table: string) => builder(table),
      rpc: async (name: string, args: Record<string, unknown>) => {
        db.rpcCalls.push({ name, args })

        return { data: db.rpcResult, error: null }
      },
    }),
  }
})

const { assignInquiryAction, unassignInquiryAction } =
  await import('@/lib/actions/inquiry-assignment-actions')
const { claimInquiryEditAction, releaseInquiryEditAction } =
  await import('@/lib/actions/inquiry-lock-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

function inquiryUpdates() {
  return db.updates.filter((entry) => entry.table === 'inquiries').map((entry) => entry.payload)
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  granted.inquiries = 'write'
  guardCalls.length = 0
  audits.length = 0
  db.inquiry = { status: 'pending', cancelled_at: null, source: 'web', assigned_to: null }
  db.profile = { nickname: '다른운영자', role: 'admin' }
  db.updates = []
  db.rpcCalls = []
  db.rpcResult = {}
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('assignInquiryAction', () => {
  it('should require inquiries write before touching anything', async () => {
    // Arrange
    granted.inquiries = 'read'

    // Act & Assert — 화면의 버튼 유무는 인가가 아니다.
    await expect(
      assignInquiryAction(
        EMPTY_FORM_STATE,
        formData({ inquiryId: INQUIRY_ID, assigneeId: ADMIN_ID }),
      ),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(guardCalls).toEqual([['inquiries', 'write']])
    expect(db.updates).toHaveLength(0)
  })

  it('should move an unassigned 접수 대기 inquiry to 처리 중 when someone takes it', async () => {
    // Arrange
    db.profile = { nickname: '운영자', role: 'admin' }

    // Act
    const state = await assignInquiryAction(
      EMPTY_FORM_STATE,
      formData({ inquiryId: INQUIRY_ID, assigneeId: ADMIN_ID }),
    )

    // Assert — 담당자가 생겼는데 '접수 대기'로 남으면 아무도 안 보는 문의처럼 보인다.
    expect(inquiryUpdates()[0]).toMatchObject({ assigned_to: ADMIN_ID })
    expect(inquiryUpdates()[1]).toMatchObject({ status: 'in_progress' })
    expect(state.message).toBe("담당자를 나에게 지정했습니다. 상태도 '처리 중'으로 옮겼습니다.")
    expect(audits.map((entry) => entry.action)).toEqual(['inquiry.assign', 'inquiry.status'])
  })

  it('should keep the status when the inquiry already moved on', async () => {
    // Arrange — 답변 완료된 문의의 담당자만 바꾸는 경우다.
    db.inquiry = { status: 'answered', cancelled_at: null, source: 'web', assigned_to: null }

    // Act
    const state = await assignInquiryAction(
      EMPTY_FORM_STATE,
      formData({ inquiryId: INQUIRY_ID, assigneeId: OTHER_ADMIN_ID }),
    )

    // Assert
    expect(inquiryUpdates()).toHaveLength(1)
    expect(state.message).toBe('담당자를 다른운영자(으)로 지정했습니다.')
  })

  it('should refuse a target that is not an admin', async () => {
    // Arrange — 직접 POST 로 일반 회원 id 를 실어 보낸 경우.
    db.profile = { nickname: '일반회원', role: 'user' }

    // Act
    const state = await assignInquiryAction(
      EMPTY_FORM_STATE,
      formData({ inquiryId: INQUIRY_ID, assigneeId: OTHER_ADMIN_ID }),
    )

    // Assert
    expect(state.formError).toBe('관리자만 담당자로 지정할 수 있습니다.')
    expect(db.updates).toHaveLength(0)
  })

  it('should say nothing changed when the same admin is assigned again', async () => {
    // Arrange
    db.inquiry = {
      status: 'in_progress',
      cancelled_at: null,
      source: 'web',
      assigned_to: OTHER_ADMIN_ID,
    }

    // Act
    const state = await assignInquiryAction(
      EMPTY_FORM_STATE,
      formData({ inquiryId: INQUIRY_ID, assigneeId: OTHER_ADMIN_ID }),
    )

    // Assert
    expect(state.formError).toBe('이미 이 운영자가 담당하고 있습니다.')
    expect(db.updates).toHaveLength(0)
  })

  it('should refuse an inquiry the user cancelled', async () => {
    // Arrange
    db.inquiry = {
      status: 'closed',
      cancelled_at: '2026-09-11T00:00:00.000Z',
      source: 'web',
      assigned_to: null,
    }

    // Act
    const state = await assignInquiryAction(
      EMPTY_FORM_STATE,
      formData({ inquiryId: INQUIRY_ID, assigneeId: ADMIN_ID }),
    )

    // Assert — 취소된 접수는 읽기 전용이다(화면에서도 버튼이 사라진다).
    expect(state.formError).toContain('사용자가 접수를 취소한 문의입니다')
    expect(db.updates).toHaveLength(0)
  })
})

describe('unassignInquiryAction', () => {
  it('should clear the assignee and leave the status alone', async () => {
    // Arrange
    db.inquiry = {
      status: 'in_progress',
      cancelled_at: null,
      source: 'web',
      assigned_to: OTHER_ADMIN_ID,
    }

    // Act
    const state = await unassignInquiryAction(EMPTY_FORM_STATE, formData({ inquiryId: INQUIRY_ID }))

    // Assert — 담당자가 빠졌다고 처리가 되돌아가지는 않는다.
    expect(inquiryUpdates()).toEqual([{ assigned_to: null, assigned_at: null }])
    expect(audits.map((entry) => entry.action)).toEqual(['inquiry.unassign'])
    expect(state.message).toBe('담당자 배정을 해제했습니다.')
  })

  it('should say nothing changed when there is no assignee', async () => {
    // Arrange & Act
    const state = await unassignInquiryAction(EMPTY_FORM_STATE, formData({ inquiryId: INQUIRY_ID }))

    // Assert
    expect(state.formError).toBe('이미 담당자가 없습니다.')
    expect(db.updates).toHaveLength(0)
  })
})

describe('claimInquiryEditAction', () => {
  it('should pass the force flag through to the rpc and audit only the takeover', async () => {
    // Arrange
    db.rpcResult = {
      ok: true,
      editing_by: ADMIN_ID,
      editing_nickname: '운영자',
      editing_at: '2026-09-11T10:00:00.000Z',
      taken_over: true,
    }

    // Act
    const result = await claimInquiryEditAction(INQUIRY_ID, true)

    // Assert
    expect(db.rpcCalls).toEqual([
      { name: 'claim_inquiry_edit', args: { p_inquiry_id: INQUIRY_ID, p_force: true } },
    ])
    expect(result.ok).toBe(true)
    expect(audits.map((entry) => entry.action)).toEqual(['inquiry.edit_lock'])
  })

  it('should not audit an ordinary heartbeat', async () => {
    // Arrange
    db.rpcResult = { ok: true, editing_by: ADMIN_ID, taken_over: false }

    // Act
    await claimInquiryEditAction(INQUIRY_ID)

    // Assert — 1분마다 한 줄씩 쌓이면 감사 로그가 못 쓰게 된다.
    expect(db.rpcCalls[0]?.args).toMatchObject({ p_force: false })
    expect(audits).toHaveLength(0)
  })

  it('should report who holds a live lock', async () => {
    // Arrange
    db.rpcResult = {
      ok: false,
      code: 'locked',
      editing_by: OTHER_ADMIN_ID,
      editing_nickname: '다른운영자',
      editing_at: '2026-09-11T09:58:00.000Z',
    }

    // Act
    const result = await claimInquiryEditAction(INQUIRY_ID)

    // Assert — 화면은 이 값으로 "OOO 관리자가 작성 중" 배너를 세운다.
    expect(result).toEqual({
      ok: false,
      editingBy: OTHER_ADMIN_ID,
      editingNickname: '다른운영자',
      editingAt: '2026-09-11T09:58:00.000Z',
    })
    expect(audits).toHaveLength(0)
  })
})

describe('releaseInquiryEditAction', () => {
  it('should ask the rpc to release only the caller lock', async () => {
    // Arrange & Act
    await releaseInquiryEditAction(INQUIRY_ID)

    // Assert — 남의 잠금을 풀 수 있으면 가로채기가 감사 로그 없이 우회된다.
    expect(db.rpcCalls).toEqual([
      { name: 'release_inquiry_edit', args: { p_inquiry_id: INQUIRY_ID } },
    ])
  })
})
