import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange } from '@/lib/utils/table-query'
import { gachaRowsSchema, type GachaDetailRow, type GachaTab } from '@/lib/validation/gacha'

import type { SortState } from '@/lib/utils/table-query'
import type { Json } from '@/types/database.types'

/**
 * 확률형 아이템 조회 (`gacha_items`).
 *
 * 사용자 사이트와 달리 **비공개 항목까지** 보여야 한다. 세션 클라이언트로 읽으면
 * `gacha_items_admin_all` 정책이 관리자에게만 전체를 열어 주므로, 권한이 사라지면
 * 목록도 함께 비는 것이 정상 동작이다.
 */

export type GachaAdminItem = {
  id: string
  tab: GachaTab
  name: string
  iconUrl: string | null
  probability: number
  isPublished: boolean
  publishedAt: string
  updatedAt: string
  rows: readonly GachaDetailRow[]
}

/** 정렬 가능한 컬럼. 여기 없는 키는 URL 로 들어와도 무시된다. */
export const GACHA_SORT_KEYS = ['name', 'probability', 'published_at', 'updated_at'] as const

export const DEFAULT_GACHA_SORT: SortState = { key: 'published_at', direction: 'desc' }

export type GachaListParams = {
  tab: GachaTab
  q: string
  sort: SortState
  page: number
}

export type GachaListResult = {
  items: readonly GachaAdminItem[]
  count: number
}

const COLUMNS = 'id, tab, name, icon_url, probability, is_published, published_at, updated_at, rows'

type GachaDbRow = {
  id: string
  tab: GachaTab
  name: string
  icon_url: string | null
  probability: number
  is_published: boolean
  published_at: string
  updated_at: string
  rows: Json
}

/**
 * `rows` 는 jsonb 라 무엇이든 들어올 수 있다. 스키마로 한 번 거른 뒤 화면에 넘긴다.
 * 깨진 행 하나 때문에 목록 전체가 죽으면 고칠 방법도 사라진다 — 그때는 빈 표로 둔다.
 */
function toItem(row: GachaDbRow): GachaAdminItem {
  const parsed = gachaRowsSchema.safeParse(row.rows)

  return {
    id: row.id,
    tab: row.tab,
    name: row.name,
    iconUrl: row.icon_url,
    probability: Number(row.probability),
    isPublished: row.is_published,
    publishedAt: row.published_at,
    updatedAt: row.updated_at,
    rows: parsed.success ? parsed.data : [],
  }
}

export async function getGachaList({
  tab,
  q,
  sort,
  page,
}: GachaListParams): Promise<GachaListResult> {
  const supabase = await createClient()
  const [from, to] = pageRange(page, DEFAULT_PAGE_SIZE)

  let query = supabase.from('gacha_items').select(COLUMNS, { count: 'exact' }).eq('tab', tab)

  if (q !== '') {
    // `%` 와 `_` 는 ilike 의 와일드카드다. 검색어에 그대로 두면 의도치 않게 넓어진다.
    query = query.ilike('name', `%${q.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`)
  }

  const { data, count, error } = await query
    .order(sort.key, { ascending: sort.direction === 'asc' })
    .order('id', { ascending: true })
    .range(from, to)

  if (error !== null) {
    console.error('[gacha] 목록 조회 실패', error.message)

    return { items: [], count: 0 }
  }

  return { items: data.map(toItem), count: count ?? 0 }
}

export async function getGachaItem(id: string): Promise<GachaAdminItem | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gacha_items')
    .select(COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  return toItem(data)
}

/** CSV 내보내기용 전량 조회. 탭 하나의 공시 목록은 수백 건 규모라 페이지를 나누지 않는다. */
export async function getGachaItemsForExport(tab: GachaTab): Promise<readonly GachaAdminItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('gacha_items')
    .select(COLUMNS)
    .eq('tab', tab)
    .order('published_at', { ascending: false })
    .order('id', { ascending: true })

  if (error !== null) {
    console.error('[gacha] 내보내기 조회 실패', error.message)

    return []
  }

  return data.map(toItem)
}
