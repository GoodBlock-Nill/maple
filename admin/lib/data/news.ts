import 'server-only'

import {
  deriveNewsStatus,
  deriveNewsVisibility,
  NEWS_BOARD,
  NEWS_CATEGORIES,
  type NewsCategoryKey,
  type NewsStatus,
  type NewsVisibility,
} from '@/lib/constants/news'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange, type SortState } from '@/lib/utils/table-query'

/**
 * 뉴스 조회 계층 (`posts` 중 `board = 'news'`).
 *
 * 세션 클라이언트로 읽는다 — 서비스 롤을 쓰면 `posts_select_admin` 정책이 건너뛰어져
 * "권한이 사라져도 목록이 그대로 보이는" 상태가 된다. 관리자 목록은 임시저장·예약·
 * 숨김·삭제까지 모두 봐야 하는데, 그 권한의 근거는 정책 하나뿐이다.
 */

/* 문자열을 이어 붙이면(`'a' + 'b'`) 타입이 그냥 `string` 이 되어 supabase-js 가
   행 타입을 추론하지 못한다(반환이 GenericStringError 로 떨어진다). 길더라도
   리터럴 한 줄로 둔다. */
const LIST_COLUMNS =
  'id, title, summary, category_key, is_published, published_at, is_hidden, is_pinned, deleted_at, view_count, updated_at, author_name'

const DETAIL_COLUMNS =
  'id, title, summary, category_key, is_published, published_at, is_hidden, is_pinned, deleted_at, view_count, updated_at, edited_at, author_name, content, content_format, author_id, created_at'

/** 헤더 클릭으로 정렬할 수 있는 컬럼. 목록 페이지와 이 배열이 어긋나면 안 된다. */
export const NEWS_SORT_KEYS = ['published_at', 'updated_at', 'view_count', 'title'] as const

export const NEWS_DEFAULT_SORT: SortState = { key: 'published_at', direction: 'desc' }

export type NewsListParams = {
  category: NewsCategoryKey | null
  status: NewsStatus | null
  /** true 면 `is_pinned = true` 인 글만 본다(상태 필터와 별개 축). */
  pinned: boolean
  q: string
  sort: SortState
  page: number
}

export type NewsListItem = {
  id: string
  title: string
  summary: string
  categoryKey: string
  /** 운영자가 무엇을 했는가(편집 상태). 필터·행 버튼이 이 값을 쓴다. */
  status: NewsStatus
  /** 사용자 사이트에 실제로 보이는가. 클라이언트 목록 쿼리와 같은 판정식이다. */
  visibility: NewsVisibility
  publishedAt: string
  viewCount: number
  updatedAt: string
  isPinned: boolean
  authorName: string
}

/** `applyNewsStatusFilter` 가 쓰는 최소 빌더 표면. 구조적 타입이라 버전 차이를 타지 않는다. */
type NewsQueryFilters<TSelf> = {
  is: (column: 'deleted_at', value: null) => TSelf
  not: (column: 'deleted_at', operator: 'is', value: null) => TSelf
  eq: (column: 'is_hidden' | 'is_published', value: boolean) => TSelf
  gt: (column: 'published_at', value: string) => TSelf
  lte: (column: 'published_at', value: string) => TSelf
}

export type NewsListResult = {
  items: readonly NewsListItem[]
  total: number
  /** 조회가 깨졌는지. `true` 면 `rows` 가 비어도 "데이터 없음"이 아니다(빈 표 오독 방지). */
  hasError: boolean
}

export type NewsDetail = {
  id: string
  title: string
  summary: string
  content: string
  categoryKey: string
  status: NewsStatus
  visibility: NewsVisibility
  isPublished: boolean
  publishedAt: string
  isPinned: boolean
  isHidden: boolean
  deletedAt: string | null
  viewCount: number
  authorName: string
  createdAt: string
  updatedAt: string
  editedAt: string | null
}

/**
 * 검색어 → `ilike` 패턴.
 *
 * `%` · `_` 는 LIKE 와일드카드라 이스케이프한다. 콤마·괄호·따옴표는 PostgREST 의
 * `or=(...)` 문법 구분자여서 값에 그대로 들어가면 필터가 통째로 깨진다 — 검색어
 * 하나 때문에 목록이 500 으로 죽지 않도록 미리 걷어낸다.
 */
function containsPattern(q: string): string | null {
  const trimmed = q.trim()

  if (trimmed === '') {
    return null
  }

  const escaped = trimmed
    .replace(/[\\%_]/gu, (match) => `\\${match}`)
    .replace(/[,()"]/gu, ' ')
    .trim()

  return escaped === '' ? null : `%${escaped}%`
}

/**
 * 상태 필터를 쿼리 조건으로 옮긴다.
 *
 * 판정 기준은 `deriveNewsStatus()` 와 같아야 한다. 화면의 뱃지와 필터 결과가
 * 어긋나면 "발행으로 보이는데 발행 필터에는 안 잡히는" 행이 생긴다.
 *
 * 빌더 타입을 제네릭으로 받는다 — `.eq()` 는 자기 자신과 같은 타입을 돌려주므로
 * 이 방식이 PostgREST 빌더의 긴 타입 인자를 옮겨 적지 않는 유일한 방법이다.
 */
function applyNewsStatusFilter<TQuery extends NewsQueryFilters<TQuery>>(
  query: TQuery,
  status: NewsStatus | null,
  nowIso: string,
): TQuery {
  if (status === 'deleted') {
    return query.not('deleted_at', 'is', null)
  }

  /* 삭제된 글은 기본 목록에서 빼 둔다. 소프트 삭제는 되돌릴 수 있으므로 지우지 않고
     `?status=deleted` 로만 꺼내 본다 — 휴지통이 평소 목록을 어지럽히지 않는다. */
  const base = query.is('deleted_at', null)

  if (status === 'hidden') {
    return base.eq('is_hidden', true)
  }

  if (status === null) {
    return base
  }

  const visible = base.eq('is_hidden', false)

  if (status === 'draft') {
    return visible.eq('is_published', false)
  }

  const published = visible.eq('is_published', true)

  return status === 'scheduled'
    ? published.gt('published_at', nowIso)
    : published.lte('published_at', nowIso)
}

export async function listNews(params: NewsListParams): Promise<NewsListResult> {
  const supabase = await createClient()
  const now = new Date()
  const [from, to] = pageRange(params.page, DEFAULT_PAGE_SIZE)
  const pattern = containsPattern(params.q)

  let query = supabase
    .from('posts')
    .select(LIST_COLUMNS, { count: 'exact' })
    .eq('board', NEWS_BOARD)

  query = applyNewsStatusFilter(query, params.status, now.toISOString())

  if (params.pinned) {
    query = query.eq('is_pinned', true)
  }

  if (params.category !== null) {
    query = query.eq('category_key', params.category)
  }

  if (pattern !== null) {
    query = query.or(`title.ilike.${pattern},summary.ilike.${pattern}`)
  }

  const { data, count, error } = await query
    .order(params.sort.key, { ascending: params.sort.direction === 'asc' })
    .range(from, to)

  if (error !== null) {
    console.error('[news] 목록 조회 실패', error.message)

    return { items: [], total: 0, hasError: true }
  }

  const items = (data ?? []).map((row) => {
    const source = {
      isPublished: row.is_published,
      publishedAt: row.published_at,
      isHidden: row.is_hidden,
      deletedAt: row.deleted_at,
    }

    return {
      id: row.id,
      title: row.title,
      summary: row.summary ?? '',
      categoryKey: row.category_key,
      status: deriveNewsStatus(source, now),
      visibility: deriveNewsVisibility(source, now),
      publishedAt: row.published_at,
      viewCount: row.view_count,
      updatedAt: row.updated_at,
      isPinned: row.is_pinned,
      authorName: row.author_name,
    }
  })

  return { items, total: count ?? 0, hasError: false }
}

export type PinnedNewsPost = {
  id: string
  title: string
}

export type PinnedNewsSummary = {
  /** 한도(`NEWS_PIN_LIMIT`)에 세는 고정 글 수. */
  count: number
  /** 현재 고정된 글의 제목 — 한도 초과 안내의 힌트로 쓴다. */
  posts: readonly PinnedNewsPost[]
  hasError: boolean
}

/**
 * 상단 고정 한도(3개) 집계.
 *
 * 세는 조건은 DB 트리거(`guard_news_pin_limit`,
 * `20260911000500_news_pin_limit.sql`)와 **반드시 같아야 한다** — 여기가
 * "몇 개까지 고정할 수 있는지" 화면에 보여 주는 유일한 근거이고, 트리거가
 * 최종 검사다. 둘이 어긋나면 화면은 "더 고정할 수 있다"고 하는데 저장은
 * 거절되는 일이 생긴다.
 *
 * `excludeId` 는 수정 중인 글 자신이다 — 이미 고정된 글을 그대로 저장할 때
 * 스스로를 한도에 넣어 세면 안 된다.
 */
export async function getPinnedNewsSummary(excludeId?: string): Promise<PinnedNewsSummary> {
  const supabase = await createClient()

  let query = supabase
    .from('posts')
    .select('id, title', { count: 'exact' })
    .eq('board', NEWS_BOARD)
    .eq('is_pinned', true)
    .eq('is_published', true)
    .eq('is_hidden', false)
    .is('deleted_at', null)

  if (excludeId !== undefined) {
    query = query.neq('id', excludeId)
  }

  const { data, count, error } = await query.order('updated_at', { ascending: false })

  if (error !== null) {
    console.error('[news] 고정 집계 실패', error.message)

    return { count: 0, posts: [], hasError: true }
  }

  return { count: count ?? 0, posts: data ?? [], hasError: false }
}

/** 작성/수정 화면이 쓰는 단건. 삭제된 글도 읽는다(복구 화면에서 내용을 확인해야 한다). */
export async function getNewsPost(id: string): Promise<NewsDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('posts')
    .select(DETAIL_COLUMNS)
    .eq('board', NEWS_BOARD)
    .eq('id', id)
    .maybeSingle()

  if (error !== null || data === null) {
    // uuid 가 아닌 id 로 들어오면 22P02(invalid input syntax) 가 난다. 404 로 다룬다.
    return null
  }

  const source = {
    isPublished: data.is_published,
    publishedAt: data.published_at,
    isHidden: data.is_hidden,
    deletedAt: data.deleted_at,
  }

  return {
    id: data.id,
    title: data.title,
    summary: data.summary ?? '',
    content: data.content,
    categoryKey: data.category_key,
    status: deriveNewsStatus(source),
    visibility: deriveNewsVisibility(source),
    isPublished: data.is_published,
    publishedAt: data.published_at,
    isPinned: data.is_pinned,
    isHidden: data.is_hidden,
    deletedAt: data.deleted_at,
    viewCount: data.view_count,
    authorName: data.author_name,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    editedAt: data.edited_at,
  }
}

export type NewsCategoryOption = {
  key: string
  label: string
}

/**
 * 카테고리 목록.
 *
 * 화면 순서·라벨의 기준은 DB(`board_categories`)다. 조회가 실패하거나 비어 있으면
 * 상수 목록으로 떨어진다 — 카테고리를 못 읽었다고 글쓰기 화면이 통째로 막히면
 * 운영이 멈춘다.
 */
export async function listNewsCategories(): Promise<readonly NewsCategoryOption[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('board_categories')
    .select('key, label')
    .eq('board', NEWS_BOARD)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })

  if (error !== null || data === null || data.length === 0) {
    return NEWS_CATEGORIES.map((category) => ({ key: category.key, label: category.label }))
  }

  return data.map((row) => ({ key: row.key, label: row.label }))
}
