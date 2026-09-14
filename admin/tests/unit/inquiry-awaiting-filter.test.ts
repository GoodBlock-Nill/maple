import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * '회원 답장 도착만' 필터(`/inquiries?awaiting=1`).
 *
 * 두 가지를 고정한다.
 *   1. 파싱 — 켜지는 값은 `'1'` 하나뿐이다. `awaiting=0` 을 참으로 읽으면 운영자가
 *      주소를 손으로 고칠 때 정반대의 목록을 본다.
 *   2. 질의 — `user_replied_at is not null`. 목록과 탭 건수가 같은 헬퍼
 *      (`applyInquiryFilters`)를 지나므로 한쪽만 확인해도 숫자가 어긋나지 않는다.
 */

vi.mock('server-only', () => ({}))

type RecordedFilter = { column: string; operator?: string; value: unknown }

const state: { filters: RecordedFilter[] } = { filters: [] }

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from(_table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        gte: () => builder,
        lt: () => builder,
        is: () => builder,
        not: (column: string, operator: string, value: unknown) => {
          state.filters.push({ column, operator, value })

          return builder
        },
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

const { getInquiries, getInquiryTabCounts } = await import('@/lib/data/inquiries')
const { parseInquiryFilters } = await import('@/lib/validation/inquiries')

const AWAITING_FILTER: RecordedFilter = {
  column: 'user_replied_at',
  operator: 'is',
  value: null,
}

function listOptions() {
  return { page: 1, sortKey: 'created_at', ascending: false, viewerId: null }
}

beforeEach(() => {
  state.filters = []
  vi.clearAllMocks()
})

describe('parseInquiryFilters — awaiting', () => {
  it("`awaiting=1` 일 때만 켠다", () => {
    expect(parseInquiryFilters({ awaiting: '1' }).awaiting).toBe(true)
  })

  it('없거나 다른 값이면 꺼진 상태다', () => {
    expect(parseInquiryFilters({}).awaiting).toBe(false)
    expect(parseInquiryFilters({ awaiting: '0' }).awaiting).toBe(false)
    expect(parseInquiryFilters({ awaiting: 'true' }).awaiting).toBe(false)
    expect(parseInquiryFilters({ awaiting: '' }).awaiting).toBe(false)
  })

  it('같은 키가 여러 번 오면 첫 값만 본다(Next 는 배열을 준다)', () => {
    expect(parseInquiryFilters({ awaiting: ['1', '0'] }).awaiting).toBe(true)
    expect(parseInquiryFilters({ awaiting: ['0', '1'] }).awaiting).toBe(false)
  })
})

describe('getInquiries — 회원 답장 도착 필터', () => {
  it('켜지면 user_replied_at 이 찍힌 문의만 남긴다', async () => {
    // Arrange
    const filters = parseInquiryFilters({ awaiting: '1' })

    // Act
    await getInquiries(filters, listOptions())

    // Assert
    expect(state.filters).toContainEqual(AWAITING_FILTER)
  })

  it('꺼져 있으면 그 조건을 걸지 않는다', async () => {
    // Arrange
    const filters = parseInquiryFilters({})

    // Act
    await getInquiries(filters, listOptions())

    // Assert
    expect(state.filters).not.toContainEqual(AWAITING_FILTER)
  })
})

describe('getInquiryTabCounts — 회원 답장 도착 필터', () => {
  it('탭 건수도 같은 조건으로 센다(표와 숫자가 어긋나면 안 된다)', async () => {
    // Arrange
    const filters = parseInquiryFilters({ awaiting: '1' })

    // Act
    await getInquiryTabCounts(filters, null)

    // Assert — 탭마다 한 번씩 걸린다(탭 수만큼 질의를 던진다).
    expect(state.filters.filter((entry) => entry.column === 'user_replied_at').length).toBe(7)
  })
})
