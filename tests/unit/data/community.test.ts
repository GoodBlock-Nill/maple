import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from '../actions/supabase-stub'

import type { SupabaseStub } from '../actions/supabase-stub'

/** `lib/data/community.ts` 는 `lib/supabase/public.ts` 를 거쳐 `server-only` 를 임포트한다. */
vi.mock('server-only', () => ({}))

/* `unstable_cache` 는 Next 요청 문맥 밖(vitest)에서 캐시 저장소를 찾지 못해
   던진다. 캐시 적중 여부 자체를 검증하는 테스트가 아니므로 항등 함수로
   대체한다(`tests/unit/data/faqs.test.ts` 와 같은 패턴). */
vi.mock('next/cache', () => ({ unstable_cache: (fn: unknown) => fn }))

/* `connection()` 은 Next 요청 문맥 밖에서 부르면 던진다(`throwForMissingRequestStore`).
   검색 경로가 실제로 호출하는지만 스파이로 확인한다. */
const connection = vi.fn(async () => undefined)
vi.mock('next/server', () => ({ connection }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/public', () => ({ createPublicClient: () => stub.client }))

const { getCommunityList } = await import('@/lib/data/community')

const ROW = {
  id: 'post-1',
  category_key: 'chat',
  title: '제목',
  content: '본문',
  content_format: 'markdown',
  author_id: 'author-1',
  author_name: '작성자',
  view_count: 0,
  like_count: 0,
  comment_count: 0,
  created_at: '2026-01-01T00:00:00Z',
  edited_at: null,
}

beforeEach(() => {
  connection.mockClear()
  stub = createSupabaseStub([{ data: [ROW], count: 1, error: null } as never])
})

describe('getCommunityList', () => {
  it('should not call connection() on the cached path (no search query)', async () => {
    // Arrange & Act
    await getCommunityList({})

    // Assert — 캐시 경로는 unstable_cache 가 신선도를 책임지므로 요청 시점으로
    // 못 박을 필요가 없다.
    expect(connection).not.toHaveBeenCalled()
  })

  it('should call connection() before reading when searching, so hidden/deleted posts never linger', async () => {
    // Arrange & Act
    const result = await getCommunityList({ q: '제목' })

    // Assert — 검색은 unstable_cache 를 우회하는 동시에, Next 의 영속 fetch 캐시도
    // 붙잡지 못하도록 요청 시점을 못 박아야 한다.
    expect(connection).toHaveBeenCalledTimes(1)
    expect(result.items).toHaveLength(1)
  })
})
