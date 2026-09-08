import { DEFAULT_GACHA_SORT, DEFAULT_GACHA_TAB, GACHA_PAGE_SIZE } from '@/lib/constants/guide'
import { GACHA_ITEMS } from '@/lib/mock/gacha'
import { matchesQuery } from '@/lib/utils/list-query'
import { accumulatedCount } from '@/lib/utils/pagination'

import type { GachaItem, GachaListParams, GachaSort, ListResult } from '@/types/domain'

/**
 * 확률형 아이템 데이터 접근 계층.
 * Phase 4에서 Supabase 쿼리로 교체되도록 목업 배열 접근을 여기에 가둔다.
 */

const COMPARATORS: Record<GachaSort, (a: GachaItem, b: GachaItem) => number> = {
  latest: (a, b) => b.updatedAt.localeCompare(a.updatedAt),
  probability: (a, b) => Number(b.probability) - Number(a.probability),
  name: (a, b) => a.name.localeCompare(b.name, 'ko'),
}

export async function getGachaList({
  tab = DEFAULT_GACHA_TAB,
  sort = DEFAULT_GACHA_SORT,
  q = '',
  page = 1,
}: GachaListParams = {}): Promise<ListResult<GachaItem>> {
  const filtered = GACHA_ITEMS.filter((item) => {
    if (item.tab !== tab) {
      return false
    }

    return matchesQuery(q, item.name)
  })

  const sorted = [...filtered].sort(COMPARATORS[sort])
  const total = sorted.length
  const shown = accumulatedCount(page, GACHA_PAGE_SIZE, total)

  return {
    items: sorted.slice(0, shown),
    total,
    shown,
    page,
    hasMore: shown < total,
  }
}

export async function getGachaItemById(id: string): Promise<GachaItem | null> {
  return GACHA_ITEMS.find((item) => item.id === id) ?? null
}
