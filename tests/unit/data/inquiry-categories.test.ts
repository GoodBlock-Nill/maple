import { beforeEach, describe, expect, it, vi } from 'vitest'

import { INQUIRY_CATEGORY_FALLBACK_LABELS } from '@/lib/constants/inquiry-category-fallback'

import { createSupabaseStub } from '../actions/supabase-stub'

import type { SupabaseStub } from '../actions/supabase-stub'

/** `lib/data/inquiry-categories.ts` 는 `lib/supabase/public.ts` 를 거쳐 `server-only` 를 임포트한다. */
vi.mock('server-only', () => ({}))

/* `unstable_cache` 는 Next 요청 문맥 밖(vitest)에서 캐시 저장소를 찾지 못해 던진다.
   통과시키는 항등 함수로 대체하되 **키를 기록한다** — 창구(kind)별로 키가 갈리지
   않으면 먼저 조회한 창구의 목록이 나머지 둘에 새어 나간다. */
const cacheKeys: unknown[][] = []
vi.mock('next/cache', () => ({
  unstable_cache: (fn: unknown, keys: unknown[]) => {
    cacheKeys.push(keys)

    return fn
  },
}))

let stub: SupabaseStub
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => stub.client }))

const { getInquiryCategories, getInquiryCategoryLabels } =
  await import('@/lib/data/inquiry-categories')

const BUG_ROWS = [
  {
    key: 'connection',
    label: '접속·서버',
    description: '접속 문제',
    prefill: '닉네임:\n내용:',
    subtypes: ['로그인/접속 불가', '강제 종료'],
    kind: 'bug',
  },
  {
    key: 'feature-ui',
    label: '기능·UI',
    description: null,
    prefill: '',
    subtypes: [],
    kind: 'bug',
  },
]

beforeEach(() => {
  stub = createSupabaseStub([{ data: BUG_ROWS, error: null } as never])
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('getInquiryCategories', () => {
  it('should map rows and keep the admin ordering', async () => {
    // Arrange & Act
    const categories = await getInquiryCategories('bug')

    // Assert — 정렬은 sort_order → created_at(동률 시 먼저 만든 쪽)로 관리자 화면과 같다.
    expect(categories).toEqual([
      {
        key: 'connection',
        label: '접속·서버',
        description: '접속 문제',
        prefill: '닉네임:\n내용:',
        subtypes: ['로그인/접속 불가', '강제 종료'],
        kind: 'bug',
      },
      {
        key: 'feature-ui',
        label: '기능·UI',
        description: null,
        prefill: '',
        subtypes: [],
        kind: 'bug',
      },
    ])
    expect(stub.orders).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: true }],
    ])
  })

  it('should ask the database for that kind only', async () => {
    // Arrange & Act — 세 라우트가 같은 폼을 쓰지만 고를 수 있는 카테고리는 다르다.
    await getInquiryCategories('bug')

    // Assert
    expect(stub.eqFilters).toContainEqual(['kind', 'bug'])
    expect(stub.eqFilters).toContainEqual(['is_active', true])
  })

  it('should cache each kind under its own key', () => {
    /* Arrange & Act & Assert — 키가 하나면 `/support/bug` 를 먼저 연 사람의 목록이
       `/support` 에도 그대로 나온다(태그는 하나 — 카테고리를 옮기면 함께 비운다). */
    expect(cacheKeys).toEqual([
      ['inquiry-categories', 'inquiry'],
      ['inquiry-categories', 'bug'],
      ['inquiry-categories', 'report'],
    ])
  })

  it('should fall back to that kind of labels when the query fails', async () => {
    // Arrange — 카테고리를 못 읽었다고 접수 폼을 막으면 장애 제보가 들어올 길이 막힌다.
    stub = createSupabaseStub([{ data: null, error: { message: 'boom' } }])

    // Act
    const categories = await getInquiryCategories('report')

    // Assert
    expect(categories.map((category) => category.label)).toEqual(
      INQUIRY_CATEGORY_FALLBACK_LABELS.report,
    )
    expect(categories.every((category) => category.kind === 'report')).toBe(true)
    expect(categories.every((category) => category.prefill === '')).toBe(true)
    /* 세부 유형도 비어 있다 — 폼은 유형 셀렉트를 잠그고 '기타' 로 접수한다.
       카테고리를 못 읽었다고 유형까지 고르라고 막아 세울 이유가 없다. */
    expect(categories.every((category) => category.subtypes.length === 0)).toBe(true)
  })

  it('should fall back when the kind has no active row', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: [], error: null } as never])

    // Act
    const categories = await getInquiryCategories('inquiry')

    // Assert
    expect(categories.map((category) => category.label)).toEqual(
      INQUIRY_CATEGORY_FALLBACK_LABELS.inquiry,
    )
  })

  it('should keep the three fallback lists apart', () => {
    /* Arrange & Act & Assert — 창구별 폴백이 같은 라벨을 들면 조회가 깨진 동안
       버그제보 폼이 1:1 문의 카테고리를 보여 주고, 접수는 트리거가 다시 옮긴다. */
    const all = [
      ...INQUIRY_CATEGORY_FALLBACK_LABELS.inquiry,
      ...INQUIRY_CATEGORY_FALLBACK_LABELS.bug,
      ...INQUIRY_CATEGORY_FALLBACK_LABELS.report,
    ]

    expect(new Set(all).size).toBe(all.length)
    expect(INQUIRY_CATEGORY_FALLBACK_LABELS.bug).toContain('접속·서버')
    expect(INQUIRY_CATEGORY_FALLBACK_LABELS.report).toContain('불법 프로그램')
  })
})

describe('getInquiryCategoryLabels', () => {
  it('should return only the labels the form offers', async () => {
    // Arrange & Act — 폼과 서버 검증이 같은 목록을 봐야 "보이는데 접수는 거절"이 없다.
    const labels = await getInquiryCategoryLabels('bug')

    // Assert
    expect(labels).toEqual(['접속·서버', '기능·UI'])
  })
})
