import { BOARD_PAGE_SIZE } from '@/lib/constants/board'
import { NEWS_ITEMS } from '@/lib/mock/news'
import { matchesQuery } from '@/lib/utils/list-query'
import { accumulatedCount } from '@/lib/utils/pagination'

import type { ListResult, NewsItem, NewsListParams } from '@/types/domain'

/**
 * 뉴스 데이터 접근 계층.
 * 화면은 이 파일의 async 함수만 호출한다. Phase 4에서 내부 구현만 Supabase
 * 쿼리로 교체하면 되도록 목업 배열 접근을 여기에 가둔다.
 */

function sortByPublishedAtDesc(items: readonly NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))
}

export async function getNewsList({
  category = null,
  q = '',
  page = 1,
}: NewsListParams = {}): Promise<ListResult<NewsItem>> {
  const filtered = sortByPublishedAtDesc(NEWS_ITEMS).filter((item) => {
    if (category !== null && item.category !== category) {
      return false
    }

    return matchesQuery(q, item.title, item.summary)
  })

  const total = filtered.length
  const shown = accumulatedCount(page, BOARD_PAGE_SIZE, total)

  return {
    items: filtered.slice(0, shown),
    total,
    shown,
    page,
    hasMore: shown < total,
  }
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
  return NEWS_ITEMS.find((item) => item.id === id) ?? null
}
