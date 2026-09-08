import { BOARD_PAGE_SIZE, DEFAULT_COMMUNITY_SORT } from '@/lib/constants/board'
import { COMMUNITY_POSTS } from '@/lib/mock/community'
import { matchesQuery } from '@/lib/utils/list-query'
import { accumulatedCount } from '@/lib/utils/pagination'

import type { CommunityListParams, CommunitySort, ListResult, Post } from '@/types/domain'

/**
 * 커뮤니티 데이터 접근 계층.
 * Phase 4에서 Supabase `posts` 쿼리로 교체된다.
 */

const COMPARATORS: Record<CommunitySort, (a: Post, b: Post) => number> = {
  latest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  views: (a, b) => b.views - a.views,
  likes: (a, b) => b.likes - a.likes,
}

export async function getCommunityList({
  category = null,
  sort = DEFAULT_COMMUNITY_SORT,
  q = '',
  page = 1,
}: CommunityListParams = {}): Promise<ListResult<Post>> {
  const filtered = COMMUNITY_POSTS.filter((post) => {
    if (category !== null && post.category !== category) {
      return false
    }

    return matchesQuery(q, post.title, post.body, post.author)
  })

  const sorted = [...filtered].sort(COMPARATORS[sort])
  const total = sorted.length
  const shown = accumulatedCount(page, BOARD_PAGE_SIZE, total)

  return {
    items: sorted.slice(0, shown),
    total,
    shown,
    page,
    hasMore: shown < total,
  }
}

export async function getPostById(id: string): Promise<Post | null> {
  return COMMUNITY_POSTS.find((post) => post.id === id) ?? null
}
