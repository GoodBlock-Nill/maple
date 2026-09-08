import { BOARD_PAGE_SIZE, DEFAULT_COMMUNITY_SORT } from '@/lib/constants/board'
import { toComment, toPost } from '@/lib/data/mappers'
import { accumulatedRange, containsPattern, toListResult } from '@/lib/data/query'
import { createClient } from '@/lib/supabase/server'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { CommunityListParams, CommunitySort, ListResult, Post } from '@/types/domain'

/**
 * 커뮤니티 데이터 접근 계층 (`posts` 중 `board = 'community'`).
 *
 * 댓글은 목록에서 조인하지 않는다. `posts.comment_count` 를 트리거가 유지해 주므로
 * 목록은 단일 테이블 스캔으로 끝나고, 상세에서만 `comments` 를 따로 읽는다.
 */

/* `author_id` · `edited_at` 은 화면에 그리지 않지만, 작성자 본인에게만 수정/삭제를
   열고 "수정됨"을 표시하려면 필요하다. */
/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const POST_COLUMNS =
  'id, category_key, title, content, author_id, author_name, view_count, like_count, comment_count, created_at, edited_at'

const COMMENT_COLUMNS = 'id, author_id, author_name, content, created_at'

/** 정렬 기준 컬럼. 값이 같을 때의 2차 정렬은 항상 최신순이다. */
const SORT_COLUMN: Record<CommunitySort, 'created_at' | 'view_count' | 'like_count'> = {
  latest: 'created_at',
  views: 'view_count',
  likes: 'like_count',
}

export async function getCommunityList({
  category = null,
  sort = DEFAULT_COMMUNITY_SORT,
  q = '',
  page = 1,
}: CommunityListParams = {}): Promise<ListResult<Post>> {
  const supabase = await createClient()
  const { from, to } = accumulatedRange(page, BOARD_PAGE_SIZE)
  const pattern = containsPattern(q)

  let query = supabase
    .from('posts')
    .select(POST_COLUMNS, { count: 'exact' })
    .eq('board', 'community')
    .eq('is_published', true)
    .is('deleted_at', null)

  if (category !== null) {
    query = query.eq('category_key', category)
  }

  if (pattern !== null) {
    query = query.ilike('title', pattern)
  }

  const { data, count, error } = await query
    .order(SORT_COLUMN[sort], { ascending: false })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error !== null) {
    throw new Error(`커뮤니티 목록을 불러오지 못했습니다: ${error.message}`)
  }

  return toListResult(
    data.map((row) => toPost(row)),
    count,
    page,
    BOARD_PAGE_SIZE,
  )
}

async function getComments(supabase: TypedSupabaseClient, postId: string) {
  const { data, error } = await supabase
    .from('comments')
    .select(COMMENT_COLUMNS)
    .eq('post_id', postId)
    .is('deleted_at', null)
    .order('created_at', { ascending: true })

  if (error !== null) {
    // 댓글을 못 읽었다고 본문까지 감출 이유는 없다. 빈 목록으로 계속 그린다.
    return []
  }

  return data.map(toComment)
}

export async function getPostById(id: string): Promise<Post | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('posts')
    .select(POST_COLUMNS)
    .eq('board', 'community')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (error !== null || data === null) {
    // uuid 가 아닌 id 는 22P02 로 떨어진다. 404 로 다룬다.
    return null
  }

  return toPost(data, await getComments(supabase, id))
}
