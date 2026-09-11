import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 문의 목록의 `user` 필터(`/inquiries?user=<id>`).
 *
 * 회원 상세의 "전체 보기" 링크가 기대하는 것은 단 하나 — 그 회원의 `user_id` 로만
 * 좁혀지는 것이다. 목록·탭 건수가 같은 헬퍼(`applyCommonFilters`)를 거치므로
 * 여기서는 목록 조회 하나만 확인해도 탭 건수도 어긋나지 않는다.
 */

vi.mock('server-only', () => ({}))

const state: { filters: { column: string; value: unknown }[] } = { filters: [] }

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from(_table: string) {
      const builder = {
        select: () => builder,
        eq: (column: string, value: unknown) => {
          state.filters.push({ column, value })

          return builder
        },
        in: () => builder,
        gte: () => builder,
        lt: () => builder,
        not: () => builder,
        or: () => builder,
        order: () => builder,
        range: () => builder,
        then: (resolve: (value: { data: unknown; count: number; error: unknown }) => unknown) =>
          resolve({ data: [], count: 0, error: null }),
      }

      return builder
    },
  })),
}))

const { getInquiries } = await import('@/lib/data/inquiries')
const { parseInquiryFilters } = await import('@/lib/validation/inquiries')

const MEMBER_ID = '11111111-2222-4333-8444-555555555555'

beforeEach(() => {
  state.filters = []
  vi.clearAllMocks()
})

describe('getInquiries — 회원 필터', () => {
  it('user 파라미터가 있으면 user_id 로 좁힌다', async () => {
    const filters = parseInquiryFilters({ user: MEMBER_ID })

    await getInquiries(filters, {
      page: 1,
      sortKey: 'created_at',
      ascending: false,
      viewerId: null,
    })

    expect(state.filters).toContainEqual({ column: 'user_id', value: MEMBER_ID })
  })

  it('user 파라미터가 없으면 user_id 필터를 걸지 않는다', async () => {
    const filters = parseInquiryFilters({})

    await getInquiries(filters, {
      page: 1,
      sortKey: 'created_at',
      ascending: false,
      viewerId: null,
    })

    expect(state.filters.some((entry) => entry.column === 'user_id')).toBe(false)
  })
})
