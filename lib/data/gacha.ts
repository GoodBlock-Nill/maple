import { unstable_cache } from 'next/cache'

import { DEFAULT_GACHA_SORT, DEFAULT_GACHA_TAB, GACHA_PAGE_SIZE } from '@/lib/constants/guide'
import { CACHE_TAGS, LIST_REVALIDATE_SECONDS } from '@/lib/data/cache'
import { toGachaItem } from '@/lib/data/mappers'
import { accumulatedRange, containsPattern, toListResult } from '@/lib/data/query'
import { createPublicClient } from '@/lib/supabase/public'

import type { GachaItem, GachaListParams, GachaSort, GachaTab, ListResult } from '@/types/domain'

/**
 * 확률형 아이템 공시 데이터 접근 계층 (`gacha_items`).
 *
 * 공개 데이터라 사용자별로 결과가 달라지지 않는다. 쿠키를 만지지 않는
 * `createPublicClient()` 로 읽고 `unstable_cache` 에 담는다
 * (`unstable_cache` 안에서는 `cookies()` 를 쓸 수 없다 — Next 16 문서).
 */

/** 정렬 기준 컬럼과 방향. `latest` 는 공시일 역순이다. */
const SORT_RULE: Record<
  GachaSort,
  { column: 'published_at' | 'probability' | 'name'; ascending: boolean }
> = {
  latest: { column: 'published_at', ascending: false },
  probability: { column: 'probability', ascending: false },
  name: { column: 'name', ascending: true },
}

async function fetchGachaList(
  tab: GachaTab,
  sort: GachaSort,
  q: string,
  page: number,
): Promise<ListResult<GachaItem>> {
  const supabase = createPublicClient()
  const { from, to } = accumulatedRange(page, GACHA_PAGE_SIZE)
  const pattern = containsPattern(q)
  const rule = SORT_RULE[sort]

  let query = supabase
    .from('gacha_items')
    .select('*', { count: 'exact' })
    .eq('tab', tab)
    .eq('is_published', true)

  if (pattern !== null) {
    query = query.ilike('name', pattern)
  }

  const { data, count, error } = await query
    .order(rule.column, { ascending: rule.ascending })
    .order('id', { ascending: true })
    .range(from, to)

  if (error !== null) {
    throw new Error(`확률형 아이템 목록을 불러오지 못했습니다: ${error.message}`)
  }

  return toListResult(data.map(toGachaItem), count, page, GACHA_PAGE_SIZE)
}

const getCachedGachaList = unstable_cache(fetchGachaList, ['gacha-list'], {
  tags: [CACHE_TAGS.gacha],
  revalidate: LIST_REVALIDATE_SECONDS,
})

export async function getGachaList({
  tab = DEFAULT_GACHA_TAB,
  sort = DEFAULT_GACHA_SORT,
  q = '',
  page = 1,
}: GachaListParams = {}): Promise<ListResult<GachaItem>> {
  return getCachedGachaList(tab, sort, q, page)
}

async function fetchGachaItem(id: string): Promise<GachaItem | null> {
  const supabase = createPublicClient()

  const { data, error } = await supabase
    .from('gacha_items')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  return toGachaItem(data)
}

const getCachedGachaItem = unstable_cache(fetchGachaItem, ['gacha-item'], {
  tags: [CACHE_TAGS.gacha],
  revalidate: LIST_REVALIDATE_SECONDS,
})

export async function getGachaItemById(id: string): Promise<GachaItem | null> {
  return getCachedGachaItem(id)
}
