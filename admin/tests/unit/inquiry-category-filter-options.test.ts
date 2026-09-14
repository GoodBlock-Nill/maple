import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 목록 필터의 카테고리 · 유형 선택지.
 *
 * 규칙은 둘이고 서로를 밀어낸다.
 *   1. 종류를 고르면 **그 창구의 카테고리만** 남는다 — 버그제보 목록에서 '결제'을 고를
 *      수 있으면 결과는 언제나 0건이다.
 *   2. **데이터에만 남은 옛 라벨은 어느 경우에도 남는다** — 그 값으로 접수된 과거
 *      문의를 필터로 찾을 유일한 길이다. 옛 라벨에는 kind 가 없으므로 창구로 걸러
 *      내면 영영 찾을 수 없게 된다.
 */

vi.mock('server-only', () => ({}))

type CategoryRow = { label: string; kind: string; subtypes: string[] }

const db = {
  categories: [] as CategoryRow[],
  /** `inquiry_category_usage()` — 라벨 기준 집계(등록이 사라진 옛 라벨도 나온다). */
  categoryUsage: [] as { category: string; total: number }[],
  /** `inquiry_type_usage()` — 유형 기준 집계. */
  typeUsage: [] as { type: string; total: number }[],
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from(_table: string) {
      const builder = {
        select: () => builder,
        order: () => builder,
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
          resolve({ data: db.categories, error: null }),
      }

      return builder
    },
    rpc: async (name: string) => ({
      data: name === 'inquiry_category_usage' ? db.categoryUsage : db.typeUsage,
      error: null,
    }),
  })),
}))

const { getInquiryCategoryFilterOptions, getInquiryTypeFilterOptions } =
  await import('@/lib/data/inquiry-categories')

beforeEach(() => {
  db.categories = [
    { label: '재화·아이템', kind: 'inquiry', subtypes: ['아이템 미지급/소실'] },
    { label: '접속·서버', kind: 'bug', subtypes: ['로그인/접속 불가', '강제 종료'] },
    { label: '불법 프로그램', kind: 'report', subtypes: ['핵/치트 프로그램'] },
  ]
  db.categoryUsage = [
    { category: '재화·아이템', total: 3 },
    // 등록이 사라진 옛 라벨. 이 값으로 접수된 과거 문의가 아직 남아 있다.
    { category: '계정', total: 7 },
  ]
  db.typeUsage = [
    { type: '로그인/접속 불가', total: 2 },
    { type: '문의', total: 5 },
  ]
})

describe('getInquiryCategoryFilterOptions', () => {
  it('should list every registered label when no kind is chosen', async () => {
    // Arrange & Act
    const options = await getInquiryCategoryFilterOptions()

    // Assert — 등록 순서 뒤에 옛 라벨이 붙는다.
    expect(options).toEqual(['재화·아이템', '접속·서버', '불법 프로그램', '계정'])
  })

  it('should narrow to the desk that was chosen', async () => {
    // Arrange & Act
    const options = await getInquiryCategoryFilterOptions('bug')

    // Assert
    expect(options).toContain('접속·서버')
    expect(options).not.toContain('재화·아이템')
    expect(options).not.toContain('불법 프로그램')
  })

  it('should keep a legacy label even inside a desk', async () => {
    /* 옛 라벨에는 kind 가 없다. 창구로 걸러 내면 '계정' 으로 접수된 과거 문의를
       찾을 길이 사라진다. */
    expect(await getInquiryCategoryFilterOptions('report')).toEqual(['불법 프로그램', '계정'])
  })
})

describe('getInquiryTypeFilterOptions', () => {
  it('should narrow the subtypes to the chosen desk', async () => {
    // Arrange & Act
    const options = await getInquiryTypeFilterOptions(null, 'bug')

    // Assert — 옛 유형('문의')은 어느 경우에도 남는다.
    expect(options).toEqual(['로그인/접속 불가', '강제 종료', '문의'])
  })

  it('should narrow to one category inside the desk', async () => {
    // Arrange & Act
    const options = await getInquiryTypeFilterOptions('접속·서버', 'bug')

    // Assert
    expect(options).toEqual(['로그인/접속 불가', '강제 종료', '문의'])
  })

  it('should drop the subtypes of other desks', async () => {
    // Arrange & Act
    const options = await getInquiryTypeFilterOptions(null, 'report')

    // Assert — '로그인/접속 불가' 는 버그제보의 유형이라 여기서는 등록 목록에 없다.
    expect(options).toContain('핵/치트 프로그램')
    expect(options).not.toContain('강제 종료')
  })

  it('should list every subtype when no kind is chosen', async () => {
    // Arrange & Act
    const options = await getInquiryTypeFilterOptions(null)

    // Assert
    expect(options).toEqual([
      '아이템 미지급/소실',
      '로그인/접속 불가',
      '강제 종료',
      '핵/치트 프로그램',
      '문의',
    ])
  })
})
