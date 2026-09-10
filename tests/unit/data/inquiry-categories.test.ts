import { beforeEach, describe, expect, it, vi } from 'vitest'

import { INQUIRY_CATEGORY_FALLBACK_LABELS } from '@/lib/constants/support'

import { createSupabaseStub } from '../actions/supabase-stub'

import type { SupabaseStub } from '../actions/supabase-stub'

/** `lib/data/inquiry-categories.ts` 는 `lib/supabase/public.ts` 를 거쳐 `server-only` 를 임포트한다. */
vi.mock('server-only', () => ({}))

/* `unstable_cache` 는 Next 요청 문맥 밖(vitest)에서 캐시 저장소를 찾지 못해 던진다.
   통과시키는 항등 함수로 대체한다(`tests/unit/data/faqs.test.ts` 와 같은 패턴). */
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => stub.client }))

const { getInquiryCategories, getInquiryCategoryLabels } =
  await import('@/lib/data/inquiry-categories')

const ROWS = [
  {
    key: 'connection',
    label: '접속·서버',
    description: '접속 문제',
    prefill: '닉네임:\n내용:',
    subtypes: ['로그인/접속 불가', '강제 종료'],
  },
  { key: 'etc', label: '기타·건의', description: null, prefill: '', subtypes: [] },
]

beforeEach(() => {
  stub = createSupabaseStub([{ data: ROWS, error: null } as never])
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('getInquiryCategories', () => {
  it('should map rows and keep the admin ordering', async () => {
    // Arrange & Act
    const categories = await getInquiryCategories()

    // Assert — 정렬은 sort_order → created_at(동률 시 먼저 만든 쪽)로 관리자 화면과 같다.
    expect(categories).toEqual([
      {
        key: 'connection',
        label: '접속·서버',
        description: '접속 문제',
        prefill: '닉네임:\n내용:',
        subtypes: ['로그인/접속 불가', '강제 종료'],
      },
      { key: 'etc', label: '기타·건의', description: null, prefill: '', subtypes: [] },
    ])
    expect(stub.orders).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: true }],
    ])
  })

  it('should fall back to the static labels when the query fails', async () => {
    // Arrange — 카테고리를 못 읽었다고 접수 폼을 막으면 장애 문의가 들어올 길이 막힌다.
    stub = createSupabaseStub([{ data: null, error: { message: 'boom' } }])

    // Act
    const categories = await getInquiryCategories()

    // Assert
    expect(categories.map((category) => category.label)).toEqual(INQUIRY_CATEGORY_FALLBACK_LABELS)
    expect(categories.every((category) => category.prefill === '')).toBe(true)
    /* 세부 유형도 비어 있다 — 폼은 유형 셀렉트를 잠그고 '기타' 로 접수한다.
       카테고리를 못 읽었다고 유형까지 고르라고 막아 세울 이유가 없다. */
    expect(categories.every((category) => category.subtypes.length === 0)).toBe(true)
  })

  it('should fall back when the table has no active row', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: [], error: null } as never])

    // Act
    const categories = await getInquiryCategories()

    // Assert
    expect(categories.map((category) => category.label)).toEqual(INQUIRY_CATEGORY_FALLBACK_LABELS)
  })
})

describe('getInquiryCategoryLabels', () => {
  it('should return only the labels the form offers', async () => {
    // Arrange & Act — 폼과 서버 검증이 같은 목록을 봐야 "보이는데 접수는 거절"이 없다.
    const labels = await getInquiryCategoryLabels()

    // Assert
    expect(labels).toEqual(['접속·서버', '기타·건의'])
  })
})
