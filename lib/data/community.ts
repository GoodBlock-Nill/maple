import { unstable_cache } from 'next/cache'
import { connection } from 'next/server'

import { BOARD_PAGE_SIZE, DEFAULT_COMMUNITY_SORT } from '@/lib/constants/board'
import { CACHE_TAGS, LIST_REVALIDATE_SECONDS } from '@/lib/data/cache'
import { toComment, toPost } from '@/lib/data/mappers'
import { accumulatedRange, containsPattern, toListResult } from '@/lib/data/query'
import { createPublicClient } from '@/lib/supabase/public'
import { createClient } from '@/lib/supabase/server'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type {
  CommunityCategory,
  CommunityListParams,
  CommunitySort,
  ListResult,
  Post,
} from '@/types/domain'

/**
 * 커뮤니티 데이터 접근 계층 (`posts` 중 `board = 'community'`).
 *
 * 댓글은 목록에서 조인하지 않는다. `posts.comment_count` 를 트리거가 유지해 주므로
 * 목록은 단일 테이블 스캔으로 끝나고, 상세에서만 `comments` 를 따로 읽는다.
 *
 * 목록만 **익명 클라이언트 + 태그 캐시**로 읽는다. 이유가 둘이다.
 *
 *   1) 신선도 — 관리자가 글을 숨기면 상세는 즉시 404 인데, 라우트 세그먼트
 *      `revalidate = 60` 에 기대던 목록에는 최대 1분간 남아 있었다. 이제 관리자 앱이
 *      `POST /api/revalidate` 로 `community-list` 태그를 태우면 다음 요청에서 사라진다.
 *   2) 일관성 — 세션 클라이언트로 읽으면 관리자에게는 `posts_select_admin` 때문에
 *      숨긴 글까지 목록에 남는다. 익명 권한으로 읽으면 누가 보든 같은 목록이다.
 *
 * 상세(`getPostById`)와 좋아요 상태는 그대로 세션 클라이언트로 읽는다 — 본인만 볼 수
 * 있는 값이 섞이므로 캐시에 담으면 안 된다.
 */

/* `author_id` · `edited_at` 은 화면에 그리지 않지만, 작성자 본인에게만 수정/삭제를
   열고 "수정됨"을 표시하려면 필요하다. */
/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const POST_COLUMNS =
  'id, category_key, title, content, content_format, author_id, author_name, view_count, like_count, comment_count, created_at, edited_at'

const COMMENT_COLUMNS = 'id, author_id, author_name, content, created_at'

/** 정렬 기준 컬럼. 값이 같을 때의 2차 정렬은 항상 최신순이다. */
const SORT_COLUMN: Record<CommunitySort, 'created_at' | 'view_count' | 'like_count'> = {
  latest: 'created_at',
  views: 'view_count',
  likes: 'like_count',
}

async function fetchCommunityList(
  category: CommunityCategory | null,
  sort: CommunitySort,
  q: string,
  page: number,
): Promise<ListResult<Post>> {
  const supabase = createPublicClient()
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

/**
 * 태그가 붙은 목록 캐시.
 *
 * `unstable_cache` 는 키에 인자를 그대로 섞으므로 말머리 · 정렬 · 페이지 조합마다
 * 항목이 하나씩 생긴다. 조합 수가 유한해야 하는 이유가 여기 있다(아래 검색 예외).
 */
const getCachedCommunityList = unstable_cache(fetchCommunityList, ['community-list'], {
  tags: [CACHE_TAGS.communityList],
  revalidate: LIST_REVALIDATE_SECONDS,
})

export async function getCommunityList({
  category = null,
  sort = DEFAULT_COMMUNITY_SORT,
  q = '',
  page = 1,
}: CommunityListParams = {}): Promise<ListResult<Post>> {
  /* 검색어는 사용자가 무한히 만들어 낸다. 캐시에 담으면 키가 끝없이 늘어나므로
     검색만 매 요청 직접 읽는다(그 대신 언제나 최신이다).
     `fetchCommunityList` 는 `createPublicClient()` 의 평범한 `fetch` 를 쓰므로,
     Next 의 영속 fetch 캐시가 이 요청을 별도로 붙잡을 여지가 이론상 남는다.
     `connection()` 으로 이 지점부터 렌더를 요청 시점으로 못 박아 매 요청 원본을
     다시 읽게 한다 — 관리자가 숨기거나 지운 글이 검색 결과에 남지 않아야 한다
     (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/connection.md`). */
  if (q !== '') {
    await connection()

    return fetchCommunityList(category, sort, q, page)
  }

  return getCachedCommunityList(category, sort, '', page)
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

/**
 * 뷰어가 이 글에 좋아요를 눌렀는가.
 *
 * `post_likes` 의 SELECT 정책이 본인 행만 열어 주므로 조회 자체가 이미 "나의"
 * 좋아요로 한정된다. 그래도 `user_id` 를 조건에 넣는 이유는 관리자 세션 때문이다.
 * 관리자에게는 전체 조회가 열려 있어서 조건을 빼면 남의 좋아요가 걸린다.
 *
 * 비로그인은 질의 없이 false 다. anon 은 이 테이블 권한 자체가 없어 요청을 보내
 * 봤자 왕복만 낭비한다.
 */
export async function getPostLikeState(postId: string, userId: string | null): Promise<boolean> {
  if (userId === null) {
    return false
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('post_likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle()

  if (error !== null) {
    // 좋아요 여부를 못 읽었다고 글을 못 보여 줄 이유는 없다. 안 누른 것으로 그린다.
    return false
  }

  return data !== null
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
