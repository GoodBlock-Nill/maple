import 'server-only'

import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 회원 활동 수치 집계.
 *
 * 목록(페이지 단위)과 상세(1명)가 같은 함수를 쓴다 — 두 화면이 다른 방식으로 세면
 * 목록의 숫자와 상세의 숫자가 어긋나고, 그 차이를 운영자가 데이터 문제로 읽는다.
 */

/** URL 길이 제한 때문에 id 를 끊어 보내는 단위. */
const IN_CHUNK = 200

export type MemberActivityCounts = {
  posts: Map<string, number>
  comments: Map<string, number>
  reported: Map<string, number>
}

/* 활동 수치 — 회원당 3질의(20명이면 60질의)를 피하려고 페이지 단위로 한 번에 센다.
   PostgREST 기본 응답 상한(1000행)에 걸리면 수치가 잘린다. 정확한 값이 필요한
   상세 화면은 `count: 'exact'` 로 다시 센다. */
export async function countActivity(
  supabase: TypedSupabaseClient,
  memberIds: readonly string[],
): Promise<MemberActivityCounts> {
  const posts = new Map<string, number>()
  const comments = new Map<string, number>()
  const reported = new Map<string, number>()

  if (memberIds.length === 0) {
    return { posts, comments, reported }
  }

  const ids = [...memberIds]
  const [postRows, commentRows] = await Promise.all([
    supabase.from('posts').select('id, author_id').eq('board', 'community').in('author_id', ids),
    supabase.from('comments').select('id, author_id').in('author_id', ids),
  ])

  /* 신고 집계는 대상 id → 작성자로 되짚어야 한다. 게시글·댓글 id 를 한 배열로 모아
     신고 테이블을 한 번만 읽는다. */
  const authorByTarget = new Map<string, string>()

  for (const row of postRows.data ?? []) {
    if (row.author_id !== null) {
      posts.set(row.author_id, (posts.get(row.author_id) ?? 0) + 1)
      authorByTarget.set(row.id, row.author_id)
    }
  }

  for (const row of commentRows.data ?? []) {
    if (row.author_id !== null) {
      comments.set(row.author_id, (comments.get(row.author_id) ?? 0) + 1)
      authorByTarget.set(row.id, row.author_id)
    }
  }

  const targetIds = [...authorByTarget.keys()]

  for (let index = 0; index < targetIds.length; index += IN_CHUNK) {
    // URL 길이 제한이 있다. id 를 200개씩 끊어 보낸다.
    const { data } = await supabase
      .from('reports')
      .select('target_id')
      .in('target_id', targetIds.slice(index, index + IN_CHUNK))

    for (const row of data ?? []) {
      const author = authorByTarget.get(row.target_id)

      if (author !== undefined) {
        reported.set(author, (reported.get(author) ?? 0) + 1)
      }
    }
  }

  return { posts, comments, reported }
}
