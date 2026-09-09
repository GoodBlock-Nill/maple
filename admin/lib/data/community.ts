import 'server-only'

import { createClient } from '@/lib/supabase/server'
import {
  DEFAULT_PAGE_SIZE,
  firstValue,
  pageRange,
  parsePage,
  parseSort,
  type QueryParams,
  type SortState,
} from '@/lib/utils/table-query'
import {
  COMMUNITY_CATEGORY_KEYS,
  containsPattern,
  CONTENT_STATUS_FILTERS,
  kstDayBoundary,
} from '@/lib/validation/moderation'

import type { ContentStatus } from '@/lib/validation/moderation'

/**
 * 커뮤니티 게시글 · 댓글 조회.
 *
 * 전부 세션 클라이언트로 읽는다. `posts_select_admin` / `comments_select_admin` 이
 * 관리자에게만 숨김·삭제 행까지 열어 주므로, 권한이 사라지면 목록도 함께 비어야
 * 한다 — 서비스 롤로 읽으면 그 검증이 통째로 사라진다.
 */

export type PostListItem = {
  id: string
  title: string
  authorId: string | null
  authorName: string
  categoryKey: string
  isHidden: boolean
  deletedAt: string | null
  commentCount: number
  likeCount: number
  viewCount: number
  createdAt: string
}

export type CommentListItem = {
  id: string
  postId: string
  postTitle: string
  content: string
  authorId: string | null
  authorName: string
  isHidden: boolean
  deletedAt: string | null
  createdAt: string
}

export type ContentListParams = {
  status: ContentStatus | null
  author: string | null
  from: string | null
  to: string | null
  sort: SortState
  page: number
}

export type PostListParams = ContentListParams & { category: string | null }

export type ListResult<TRow> = {
  rows: readonly TRow[]
  count: number
  page: number
  /** 조회가 깨졌는지. `true` 면 `rows` 가 비어도 "데이터 없음"이 아니다(빈 표 오독 방지). */
  hasError: boolean
}

const POST_SORT_KEYS = ['created_at', 'comment_count', 'like_count', 'view_count'] as const
const COMMENT_SORT_KEYS = ['created_at'] as const

const DEFAULT_SORT: SortState = { key: 'created_at', direction: 'desc' }

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const POST_COLUMNS =
  'id, title, author_id, author_name, category_key, is_hidden, deleted_at, comment_count, like_count, view_count, created_at'

/* prettier-ignore */
const COMMENT_COLUMNS =
  'id, post_id, content, author_id, author_name, is_hidden, deleted_at, created_at, posts(title)'

function parseContentParams(params: QueryParams, sortKeys: readonly string[]): ContentListParams {
  const status = firstValue(params.status)

  return {
    status: CONTENT_STATUS_FILTERS.includes(status as ContentStatus)
      ? (status as ContentStatus)
      : null,
    author: firstValue(params.author),
    from: firstValue(params.from),
    to: firstValue(params.to),
    sort: parseSort(params.sort, sortKeys, DEFAULT_SORT),
    page: parsePage(params.page),
  }
}

export function parsePostListParams(params: QueryParams): PostListParams {
  const category = firstValue(params.category)

  return {
    ...parseContentParams(params, POST_SORT_KEYS),
    category: COMMUNITY_CATEGORY_KEYS.includes(category as (typeof COMMUNITY_CATEGORY_KEYS)[number])
      ? category
      : null,
  }
}

export function parseCommentListParams(params: QueryParams): ContentListParams {
  return parseContentParams(params, COMMENT_SORT_KEYS)
}

export async function getCommunityPosts(params: PostListParams): Promise<ListResult<PostListItem>> {
  const supabase = await createClient()
  const [from, to] = pageRange(params.page, DEFAULT_PAGE_SIZE)

  let query = supabase
    .from('posts')
    .select(POST_COLUMNS, { count: 'exact' })
    .eq('board', 'community')

  if (params.category !== null) {
    query = query.eq('category_key', params.category)
  }

  query = applyStatusFilter(query, params.status)

  const pattern = containsPattern(params.author)

  if (pattern !== null) {
    query = query.ilike('author_name', pattern)
  }

  const since = kstDayBoundary(params.from)
  const until = kstDayBoundary(params.to, 1)

  if (since !== null) {
    query = query.gte('created_at', since)
  }

  if (until !== null) {
    query = query.lt('created_at', until)
  }

  const { data, count, error } = await query
    .order(params.sort.key, { ascending: params.sort.direction === 'asc' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error !== null) {
    console.error('[community] 게시글 목록 조회 실패', error.message)

    return { rows: [], count: 0, page: params.page, hasError: true }
  }

  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      title: row.title,
      authorId: row.author_id,
      authorName: row.author_name,
      categoryKey: row.category_key,
      isHidden: row.is_hidden,
      deletedAt: row.deleted_at,
      commentCount: row.comment_count,
      likeCount: row.like_count,
      viewCount: row.view_count,
      createdAt: row.created_at,
    })),
    count: count ?? 0,
    page: params.page,
    hasError: false,
  }
}

export async function getCommunityComments(
  params: ContentListParams,
): Promise<ListResult<CommentListItem>> {
  const supabase = await createClient()
  const [from, to] = pageRange(params.page, DEFAULT_PAGE_SIZE)

  let query = supabase.from('comments').select(COMMENT_COLUMNS, { count: 'exact' })

  query = applyStatusFilter(query, params.status)

  const pattern = containsPattern(params.author)

  if (pattern !== null) {
    query = query.ilike('author_name', pattern)
  }

  const since = kstDayBoundary(params.from)
  const until = kstDayBoundary(params.to, 1)

  if (since !== null) {
    query = query.gte('created_at', since)
  }

  if (until !== null) {
    query = query.lt('created_at', until)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: params.sort.direction === 'asc' })
    .range(from, to)

  if (error !== null) {
    console.error('[community] 댓글 목록 조회 실패', error.message)

    return { rows: [], count: 0, page: params.page, hasError: true }
  }

  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      postId: row.post_id,
      postTitle: row.posts?.title ?? '(삭제된 게시글)',
      content: row.content,
      authorId: row.author_id,
      authorName: row.author_name,
      isHidden: row.is_hidden,
      deletedAt: row.deleted_at,
      createdAt: row.created_at,
    })),
    count: count ?? 0,
    page: params.page,
    hasError: false,
  }
}

/**
 * 카테고리 키 → 라벨.
 *
 * 라벨을 코드에 박지 않는다. `board_categories` 가 사용자 사이트와 공유하는
 * 단일 출처이므로, 운영자가 라벨을 바꾸면 관리자 화면도 함께 바뀌어야 한다.
 */
export async function getCommunityCategoryLabels(): Promise<Record<string, string>> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('board_categories')
    .select('key, label')
    .eq('board', 'community')
    .order('sort_order', { ascending: true })

  if (error !== null) {
    console.error('[community] 카테고리 조회 실패', error.message)

    return {}
  }

  return Object.fromEntries((data ?? []).map((row) => [row.key, row.label]))
}

/* 상태 필터는 게시글·댓글이 같은 두 컬럼(is_hidden · deleted_at)을 쓴다.
   제네릭 빌더로 받아 한 곳에서만 조건을 정의한다. */
type StatusFilterable<TQuery> = {
  eq: (column: 'is_hidden', value: boolean) => TQuery
  is: (column: 'deleted_at', value: null) => TQuery
  not: (column: 'deleted_at', operator: 'is', value: null) => TQuery
}

function applyStatusFilter<TQuery extends StatusFilterable<TQuery>>(
  query: TQuery,
  status: ContentStatus | null,
): TQuery {
  if (status === 'visible') {
    return query.eq('is_hidden', false).is('deleted_at', null)
  }

  if (status === 'hidden') {
    return query.eq('is_hidden', true).is('deleted_at', null)
  }

  if (status === 'deleted') {
    return query.not('deleted_at', 'is', null)
  }

  return query
}
