import { unstable_cache } from 'next/cache'
import { connection } from 'next/server'

import { BOARD_PAGE_SIZE } from '@/lib/constants/board'
import { CACHE_TAGS, LIST_REVALIDATE_SECONDS } from '@/lib/data/cache'
import { toAdjacentNewsItem, toNewsItem } from '@/lib/data/mappers'
import { accumulatedRange, containsPattern, toListResult } from '@/lib/data/query'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type {
  AdjacentNews,
  AdjacentNewsItem,
  ListResult,
  NewsCategory,
  NewsItem,
  NewsListParams,
} from '@/types/domain'

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
 *
 * 그 "누가 보든 같다"를 권한 수준에서도 못 박으려고 목록만 익명 클라이언트로 읽고
 * `news-list` 태그를 달아 캐시한다(커뮤니티 목록과 같은 이유 — `lib/data/community.ts`).
 * 관리자가 뉴스를 숨기거나 지우면 `POST /api/revalidate` 로 이 태그를 태운다.
 */

/**
 * 목록·상세가 같은 컬럼 집합을 읽는다(`toNewsItem` 하나로 매핑하므로 갈라 둘 이유가 없다).
 * `is_pinned` 는 이미 목록 정렬 키였는데, 카드형 목록이 핀 아이콘으로 그리면서
 * 값 자체도 필요해졌다(docs/reference/figma/news-v2-spec.md §4).
 */
const NEWS_COLUMNS =
  'id, category_key, title, summary, content, content_format, thumbnail_url, view_count, published_at, edited_at, is_pinned'

async function fetchNewsList(
  category: NewsCategory | null,
  q: string,
  page: number,
): Promise<ListResult<NewsItem>> {
  const supabase = createPublicClient()
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

const getCachedNewsList = unstable_cache(fetchNewsList, ['news-list'], {
  tags: [CACHE_TAGS.newsList],
  revalidate: LIST_REVALIDATE_SECONDS,
})

export async function getNewsList({
  category = null,
  q = '',
  page = 1,
}: NewsListParams = {}): Promise<ListResult<NewsItem>> {
  /* 검색어는 사용자가 무한히 만들어 낸다. 캐시 키가 끝없이 늘어나지 않도록
     검색만 매 요청 직접 읽는다. `connection()` 으로 이 지점을 요청 시점으로
     못 박아, Next 의 영속 fetch 캐시가 이전 응답을 돌려줄 여지를 없앤다 —
     관리자가 숨기거나 지운 글이 검색 결과에 남지 않아야 한다
     (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`). */
  if (q !== '') {
    await connection()

    return fetchNewsList(category, q, page)
  }

  return getCachedNewsList(category, '', page)
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

const ADJACENT_NEWS_COLUMNS = 'id, category_key, title, published_at'

/**
 * 상세 페이지의 이전/다음 글.
 *
 * 정렬 기준은 `published_at` 뿐이다(목록의 `is_pinned` 정렬은 여기서 관계없다) —
 * "이전/다음"은 사용자가 읽던 흐름(발행 시각)을 따라가는 내비게이션이라서다.
 * `id` 를 2차 정렬로 더해, 같은 초에 발행된 글이 있어도 결과가 흔들리지 않게 한다.
 */
async function getAdjacentNewsBySide(
  supabase: TypedSupabaseClient,
  currentId: string,
  publishedAt: string,
  side: 'prev' | 'next',
): Promise<AdjacentNewsItem | null> {
  const isPrev = side === 'prev'

  let query = supabase
    .from('posts')
    .select(ADJACENT_NEWS_COLUMNS)
    .eq('board', 'news')
    .eq('is_published', true)
    .is('deleted_at', null)
    .neq('id', currentId)

  query = isPrev ? query.lte('published_at', publishedAt) : query.gte('published_at', publishedAt)

  const { data, error } = await query
    .order('published_at', { ascending: !isPrev })
    .order('id', { ascending: !isPrev })
    .limit(1)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  return toAdjacentNewsItem(data)
}

/**
 * 현재 글의 `publishedAt` 을 이미 알고 있을 때(상세 페이지가 `getNewsById` 로
 * 미리 읽어 둔 값) 쓴다. 다시 조회하지 않아 왕복이 하나 줄어든다.
 */
export async function getAdjacentNews(id: string, publishedAt: string): Promise<AdjacentNews> {
  const supabase = await createClient()

  const [prev, next] = await Promise.all([
    getAdjacentNewsBySide(supabase, id, publishedAt, 'prev'),
    getAdjacentNewsBySide(supabase, id, publishedAt, 'next'),
  ])

  return { prev, next }
}
