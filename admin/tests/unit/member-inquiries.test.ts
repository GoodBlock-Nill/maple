import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 회원 상세 "1:1 문의" 탭 데이터 매퍼.
 *
 * 총 건수는 상세 화면의 지표 카드(`getMemberActivity` 의 `inquiryCount`)와 같은
 * 조건(`user_id`)으로 세므로 별도로 테스트하지 않는다 — 여기서는 행 매핑과
 * `user_id` 스코프, 조회 실패 시의 `hasError` 만 고정한다.
 */

vi.mock('server-only', () => ({}))

type QueryState = {
  filters: { column: string; value: unknown }[]
  orderedBy: { column: string; ascending: boolean } | null
  limitedTo: number | null
}

const state: QueryState = { filters: [], orderedBy: null, limitedTo: null }

let rows: unknown[] = []
let queryError: { message: string } | null = null

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from(_table: string) {
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          state.filters.push({ column, value })

          return builder
        },
        order: (column: string, options: { ascending: boolean }) => {
          state.orderedBy = { column, ascending: options.ascending }

          return builder
        },
        limit: (count: number) => {
          state.limitedTo = count

          return builder
        },
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
          resolve({ data: rows, error: queryError }),
      }

      return builder
    },
  })),
}))

const { getMemberInquiries } = await import('@/lib/data/member-inquiries')

const MEMBER_ID = '11111111-2222-4333-8444-555555555555'

beforeEach(() => {
  state.filters = []
  state.orderedBy = null
  state.limitedTo = null
  rows = []
  queryError = null
  vi.clearAllMocks()
})

describe('getMemberInquiries', () => {
  it('회원의 user_id 로만 좁히고, 최신순 · 상한 건수로 읽는다', async () => {
    await getMemberInquiries(MEMBER_ID)

    expect(state.filters).toEqual([{ column: 'user_id', value: MEMBER_ID }])
    expect(state.orderedBy).toEqual({ column: 'created_at', ascending: false })
    expect(state.limitedTo).toBe(20)
  })

  it('목록 컬럼(카테고리 · 유형 · 상태 · 출처 · 답변 수)을 그대로 매핑한다', async () => {
    rows = [
      {
        id: 'inq-1',
        title: '결제가 안 돼요',
        category: '결제',
        type: '오류',
        status: 'in_progress',
        cancelled_at: null,
        source: 'web',
        created_at: '2026-09-01T00:00:00Z',
        inquiry_replies: [{ count: 2 }],
      },
    ]

    const result = await getMemberInquiries(MEMBER_ID)

    expect(result.hasError).toBe(false)
    expect(result.rows).toEqual([
      {
        id: 'inq-1',
        title: '결제가 안 돼요',
        category: '결제',
        type: '오류',
        status: 'in_progress',
        cancelledAt: null,
        source: 'web',
        replyCount: 2,
        createdAt: '2026-09-01T00:00:00Z',
      },
    ])
  })

  it('답변이 없으면 0으로, 출처를 모르면 웹으로 떨어뜨린다', async () => {
    rows = [
      {
        id: 'inq-2',
        title: '문의',
        category: '기타',
        type: '일반',
        status: 'pending',
        cancelled_at: null,
        source: 'kakao',
        created_at: '2026-09-02T00:00:00Z',
        inquiry_replies: [],
      },
    ]

    const result = await getMemberInquiries(MEMBER_ID)

    expect(result.rows[0]?.replyCount).toBe(0)
    expect(result.rows[0]?.source).toBe('web')
  })

  it('조회가 깨지면 hasError 를 세우고 빈 표를 돌려준다(오독 방지)', async () => {
    queryError = { message: 'permission denied for table inquiries' }
    rows = [{ id: 'inq-3' }]

    const result = await getMemberInquiries(MEMBER_ID)

    expect(result.hasError).toBe(true)
    expect(result.rows).toEqual([])
  })
})
