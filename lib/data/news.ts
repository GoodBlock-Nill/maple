import { BOARD_PAGE_SIZE } from '@/lib/constants/board'
import { toNewsItem } from '@/lib/data/mappers'
import { accumulatedRange, containsPattern, toListResult } from '@/lib/data/query'
import { createClient } from '@/lib/supabase/server'

import type { ListResult, NewsItem, NewsListParams } from '@/types/domain'

/**
 * 뉴스 데이터 접근 계층 (`posts` 중 `board = 'news'`).
 *
 * 목록은 "더보기" 누적 로드라 매번 0번 행부터 `page * BOARD_PAGE_SIZE` 건을
 * 읽는다. 전체 건수는 같은 왕복에서 `count: 'exact'` 로 받는다.
 *
 * 공개 여부(`is_published` · `deleted_at` · `published_at <= now()`)는 RLS 가
 * 이미 걸러 주지만, 로그인한 작성자·관리자에게는 자기 글이 추가로 보이는
 * 정책이 있으므로 목록 쿼리에서 한 번 더 명시한다. 그래야 누가 보든 같은
 * 목록·같은 건수가 나온다.
 */

const NEWS_COLUMNS =
  'id, category_key, title, summary, content, thumbnail_url, view_count, published_at'

export async function getNewsList({
  category = null,
  q = '',
  page = 1,
}: NewsListParams = {}): Promise<ListResult<NewsItem>> {
  const supabase = await createClient()
  const { from, to } = accumulatedRange(page, BOARD_PAGE_SIZE)
  const pattern = containsPattern(q)

  let query = supabase
    .from('posts')
    .select(NEWS_COLUMNS, { count: 'exact' })
    .eq('board', 'news')
    .eq('is_published', true)
    .is('deleted_at', null)

  if (category !== null) {
    query = query.eq('category_key', category)
  }

  if (pattern !== null) {
    query = query.ilike('title', pattern)
  }

  const { data, count, error } = await query
    .order('is_pinned', { ascending: false })
    .order('published_at', { ascending: false })
    .range(from, to)

  if (error !== null) {
    throw new Error(`뉴스 목록을 불러오지 못했습니다: ${error.message}`)
  }

  return toListResult(data.map(toNewsItem), count, page, BOARD_PAGE_SIZE)
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('posts')
    .select(NEWS_COLUMNS)
    .eq('board', 'news')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error !== null) {
    // uuid 가 아닌 id 로 들어오면 22P02(invalid input syntax) 가 난다. 404 로 다룬다.
    return null
  }

  return data === null ? null : toNewsItem(data)
}
