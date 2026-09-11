import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 저장 시 충돌 감지.
 *
 * 소프트 락은 "동시에 쓰고 있다"를 알려 줄 뿐 막지 못한다(가로채기도 열려 있다).
 * 마지막 방어선은 저장하는 순간의 비교다 — 화면을 연 시점의 답변 수·상태와 지금
 * DB 가 다르면, 그사이 누군가 먼저 처리한 것이다.
 *
 * 고정하려는 것은 셋이다.
 *   1. 답변 액션은 화면이 실어 보낸 스냅샷을 **그대로** RPC 에 넘긴다(비교는 DB 가
 *      한 트랜잭션 안에서 한다 — 앱에서 두 번 왕복하면 그 사이에 끼어들 수 있다).
 *   2. `conflict` 응답은 한국어 문구 + `code: 'conflict'` 로 돌아온다. 화면은 코드로
 *      갈라야 한다(문구를 다듬는 순간 동작이 깨지지 않도록).
 *   3. 상태 변경도 같은 스냅샷을 본다.
 */

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const INQUIRY_ID = '33333333-3333-4333-8333-333333333333'
const REPLY_ID = '55555555-5555-4555-8555-555555555555'

const CONFLICT_MESSAGE = '다른 운영자가 먼저 처리했습니다. 최신 내용을 확인해 주세요.'

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

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ACTOR),
  requireAnyPermission: vi.fn(async () => ACTOR),
  requireSuperAdmin: vi.fn(async () => ACTOR),
  requirePermission: vi.fn(async () => ACTOR),
}))

const audits: { action: string }[] = []

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(async (_actorId: string, entry: { action: string }) => {
    audits.push(entry)
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const db = vi.hoisted(() => ({
  inquiry: null as Record<string, unknown> | null,
  replyCount: 0,
  updates: [] as Record<string, unknown>[],
  rpcCalls: [] as { name: string; args: Record<string, unknown> }[],
  rpcResult: {} as Record<string, unknown>,
}))

vi.mock('@/lib/supabase/server', () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {
      select: () => chain,
      update: (payload: Record<string, unknown>) => {
        db.updates.push(payload)

        return chain
      },
      eq: () => chain,
      maybeSingle: async () => ({ data: db.inquiry, error: null }),
      then: (resolve: (value: unknown) => unknown) =>
        resolve({
          data: null,
          // 답변 수 집계(`head: true`)는 count 로만 돌아온다.
          count: table === 'inquiry_replies' ? db.replyCount : 0,
          error: null,
        }),
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

const { replyToInquiryAction, updateInquiryStatusAction } =
  await import('@/lib/actions/inquiries-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

function replyForm(overrides: Record<string, string> = {}): FormData {
  return formData({
    inquiryId: INQUIRY_ID,
    content: '확인 후 답변드립니다.',
    nextStatus: 'answered',
    useOperatorName: 'on',
    expectedReplyCount: '0',
    expectedStatus: 'pending',
    ...overrides,
  })
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  audits.length = 0
  db.inquiry = { status: 'pending', cancelled_at: null, source: 'web', assigned_to: null }
  db.replyCount = 0
  db.updates = []
  db.rpcCalls = []
  db.rpcResult = { ok: true, reply_id: REPLY_ID, reply_count: 1 }
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('replyToInquiryAction — 스냅샷', () => {
  it('should hand the loaded snapshot to the database function', async () => {
    // Arrange & Act
    await replyToInquiryAction(EMPTY_FORM_STATE, replyForm())

    // Assert — 비교는 DB 가 문의 행을 잠근 채로 한다.
    expect(db.rpcCalls[0]).toMatchObject({
      name: 'add_inquiry_reply',
      args: { p_expected_reply_count: 0, p_expected_status: 'pending' },
    })
  })

  it('should skip the comparison when the form carries no snapshot', async () => {
    // Arrange & Act — 옛 탭 · 직접 POST. 충돌 감지는 보안 경계가 아니라 협업 장치다.
    await replyToInquiryAction(
      EMPTY_FORM_STATE,
      replyForm({ expectedReplyCount: '', expectedStatus: '' }),
    )

    // Assert
    expect(db.rpcCalls[0]?.args).toMatchObject({
      p_expected_reply_count: null,
      p_expected_status: null,
    })
  })

  it('should not send a status the enum does not know', async () => {
    // Arrange & Act — 캐스팅이 실패하면 22P02 로 저장 자체가 깨진다.
    await replyToInquiryAction(EMPTY_FORM_STATE, replyForm({ expectedStatus: 'whatever' }))

    // Assert
    expect(db.rpcCalls[0]?.args).toMatchObject({ p_expected_status: null })
  })
})

describe('replyToInquiryAction — conflict', () => {
  it('should translate the rejection and keep the draft on screen', async () => {
    // Arrange
    db.rpcResult = { ok: false, code: 'conflict', reply_count: 1, status: 'answered' }

    // Act
    const state = await replyToInquiryAction(EMPTY_FORM_STATE, replyForm())

    /* Assert — 코드까지 돌려줘야 화면이 "스레드만 새로 고치고 초안은 그대로" 를
       문구 비교 없이 판단할 수 있다. 답변은 저장되지 않았으므로 감사 로그도 없다. */
    expect(state.formError).toBe(CONFLICT_MESSAGE)
    expect(state.code).toBe('conflict')
    expect(state.message).toBeUndefined()
    expect(audits).toHaveLength(0)
  })

  it('should not log a developer error for a conflict', async () => {
    // Arrange
    db.rpcResult = { ok: false, code: 'conflict' }

    // Act
    await replyToInquiryAction(EMPTY_FORM_STATE, replyForm())

    // Assert — 충돌은 정상적인 운영 상황이다(둘이 같은 문의를 봤을 뿐이다).
    expect(errorSpy).not.toHaveBeenCalled()
  })

  it('should fall back to a fixed sentence for an unknown rejection', async () => {
    // Arrange
    db.rpcResult = { ok: false, code: 'weird' }

    // Act
    const state = await replyToInquiryAction(EMPTY_FORM_STATE, replyForm())

    // Assert — 화면에는 고정 문장, 원인은 서버 로그로만.
    expect(state.formError).toBe(
      '답변을 등록하지 못했습니다. 작성한 내용은 그대로 있으니 잠시 후 다시 저장해 주세요.',
    )
    expect(state.code).toBeUndefined()
    expect(errorSpy).toHaveBeenCalled()
  })
})

describe('updateInquiryStatusAction — conflict', () => {
  it('should refuse when the thread moved on since the page was opened', async () => {
    // Arrange — 화면은 답변 0건일 때 열렸는데 지금은 1건이다.
    db.replyCount = 1

    // Act
    const state = await updateInquiryStatusAction(
      EMPTY_FORM_STATE,
      formData({
        inquiryId: INQUIRY_ID,
        status: 'closed',
        expectedStatus: 'pending',
        expectedReplyCount: '0',
      }),
    )

    // Assert
    expect(state.formError).toBe(CONFLICT_MESSAGE)
    expect(state.code).toBe('conflict')
    expect(db.updates).toHaveLength(0)
  })

  it('should refuse when the status itself changed', async () => {
    // Arrange
    db.inquiry = { status: 'answered', cancelled_at: null, source: 'web', assigned_to: null }

    // Act
    const state = await updateInquiryStatusAction(
      EMPTY_FORM_STATE,
      formData({
        inquiryId: INQUIRY_ID,
        status: 'closed',
        expectedStatus: 'pending',
        expectedReplyCount: '0',
      }),
    )

    // Assert
    expect(state.formError).toBe(CONFLICT_MESSAGE)
    expect(db.updates).toHaveLength(0)
  })

  it('should go through when nothing moved', async () => {
    // Arrange & Act
    const state = await updateInquiryStatusAction(
      EMPTY_FORM_STATE,
      formData({
        inquiryId: INQUIRY_ID,
        status: 'closed',
        expectedStatus: 'pending',
        expectedReplyCount: '0',
      }),
    )

    // Assert
    expect(db.updates).toEqual([{ status: 'closed' }])
    expect(state.message).toBe("상태를 '종료'로 바꿨습니다.")
  })
})
