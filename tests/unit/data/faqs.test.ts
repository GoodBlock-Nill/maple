import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from '../actions/supabase-stub'

import type { SupabaseStub } from '../actions/supabase-stub'

/** `lib/data/faqs.ts` 는 `lib/supabase/public.ts` 를 거쳐 `server-only` 를 임포트한다. */
vi.mock('server-only', () => ({}))

/* `unstable_cache` 는 Next 요청 문맥 밖(vitest)에서 그대로 두면 캐시 저장소를
   찾지 못해 예외를 던진다. 정렬 호출만 보는 이 테스트에서는 통과시키는
   항등 함수로 대체한다(`tests/unit/actions/*-actions.test.ts` 와 같은 패턴). */
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => stub.client }))

const { getFaqGroups } = await import('@/lib/data/faqs')

beforeEach(() => {
  stub = createSupabaseStub([{ data: [], error: null } as never])
})

describe('getFaqGroups', () => {
  it('should order by sort_order then created_at as a tie-break, matching the admin', async () => {
    // Arrange & Act
    await getFaqGroups()

    // Assert — sort_order 가 같으면 등록이 빠른 쪽을 위에 둔다(관리자 화면과 동일).
    expect(stub.orders).toEqual([
      ['sort_order', { ascending: true }],
      ['created_at', { ascending: true }],
    ])
  })

  it('should surface a query failure as a readable error', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: null, error: { message: 'boom' } }])

    // Act & Assert
    await expect(getFaqGroups()).rejects.toThrow('자주 묻는 질문을 불러오지 못했습니다')
  })
})
