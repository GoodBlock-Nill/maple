import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * `resolveReportAction` / `dismissReportAction` 이 서비스 롤 경로(`setReportStatus`)에
 * 실어 보내는 UPDATE payload 를 검증한다.
 *
 * 20260908002100 이 `reports.note` · `resolved_by` · `resolved_at` 를 추가했으므로
 * 처리·기각 액션은 `status` 뿐 아니라 이 세 컬럼도 함께 채워야 한다(신고 큐에서
 * "누가 · 언제 처리했는지" 를 감사 로그를 열어 보지 않고도 확인하려면 행 자체가
 * 값을 들고 있어야 한다).
 *
 * `action: 'none'` 으로만 검증한다 — `moderateTarget`/`suspendMember` 를 타지 않는
 * 경로라 이 테스트의 관심사(처리 payload)와 무관한 의존성을 목으로 채우지 않아도 된다.
 */

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const REPORT_ID = '22222222-2222-4222-8222-222222222222'

vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ({
    id: ADMIN_ID,
    email: 'admin@stub.local',
    nickname: '운영자',
    role: 'admin',
  })),
}))

vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }))
vi.mock('@/lib/actions/moderation-actions', () => ({ moderateTarget: vi.fn(async () => null) }))
vi.mock('@/lib/actions/members-actions', () => ({ suspendMember: vi.fn(async () => null) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const reportRow = {
  id: REPORT_ID,
  target_type: 'post',
  target_id: '33333333-3333-4333-8333-333333333333',
  status: 'open',
}

/* `readReport()` 는 세션 클라이언트로 신고 원본을 읽는다. `applyToTarget: '0'` 만
   테스트하므로 `openReportIdsForTarget()` 은 부르지 않아 별도로 흉내 낼 필요가 없다. */
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: reportRow, error: null }),
        }),
      }),
    }),
  }),
}))

const updateCalls: unknown[] = []

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({
      update: (payload: unknown) => {
        updateCalls.push(payload)

        return { in: async () => ({ error: null }) }
      },
    }),
  }),
}))

const { resolveReportAction, dismissReportAction } = await import('@/lib/actions/reports-actions')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

beforeEach(() => {
  updateCalls.length = 0
})

describe('resolveReportAction', () => {
  it('should write resolved_by/resolved_at/note alongside status', async () => {
    // Arrange
    const before = Date.now()

    // Act
    const result = await resolveReportAction(
      {},
      formData({
        reportId: REPORT_ID,
        action: 'none',
        note: '확인 결과 정상 게시물',
        applyToTarget: '0',
      }),
    )

    // Assert
    expect(result.formError).toBeUndefined()
    expect(updateCalls).toHaveLength(1)

    const payload = updateCalls[0] as {
      status: string
      note: string | null
      resolved_by: string
      resolved_at: string
    }

    expect(payload.status).toBe('resolved')
    expect(payload.note).toBe('확인 결과 정상 게시물')
    expect(payload.resolved_by).toBe(ADMIN_ID)
    expect(new Date(payload.resolved_at).getTime()).toBeGreaterThanOrEqual(before)
  })
})

describe('dismissReportAction', () => {
  it('should write resolved_by/resolved_at/note alongside status', async () => {
    // Arrange
    const before = Date.now()

    // Act
    const result = await dismissReportAction(
      {},
      formData({ reportId: REPORT_ID, note: '근거 부족으로 기각', applyToTarget: '0' }),
    )

    // Assert
    expect(result.formError).toBeUndefined()
    expect(updateCalls).toHaveLength(1)

    const payload = updateCalls[0] as {
      status: string
      note: string | null
      resolved_by: string
      resolved_at: string
    }

    expect(payload.status).toBe('dismissed')
    expect(payload.note).toBe('근거 부족으로 기각')
    expect(payload.resolved_by).toBe(ADMIN_ID)
    expect(new Date(payload.resolved_at).getTime()).toBeGreaterThanOrEqual(before)
  })
})
