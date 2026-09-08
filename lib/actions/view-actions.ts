'use server'

import { cookies } from 'next/headers'

import {
  hasViewedPost,
  isPostId,
  parseViewedPosts,
  serializeViewedPosts,
  VIEW_COOKIE_MAX_AGE,
  VIEW_COOKIE_NAME,
  withViewedPost,
} from '@/lib/actions/view-guard'
import { createClient } from '@/lib/supabase/server'

/**
 * 조회수 +1.
 *
 * `posts.view_count` 는 `guard_post_counters()` 트리거가 잠가 두어 일반 UPDATE 로는
 * 못 올린다. 익명 사용자도 조회수를 올려야 하므로 DB 는 `increment_post_view(p_id)`
 * RPC(SECURITY DEFINER)만 열어 두었고, 여기서는 그 RPC 만 호출한다.
 *
 * 쿠키 쓰기는 서버 컴포넌트 렌더 중에는 불가능하다(Next 16 문서). 그래서 상세
 * 페이지가 직접 호출하지 않고, 작은 클라이언트 컴포넌트가 마운트 후 이 서버
 * 액션을 부른다.
 */
export async function recordPostView(postId: string): Promise<void> {
  if (!isPostId(postId)) {
    return
  }

  const cookieStore = await cookies()
  const viewed = parseViewedPosts(cookieStore.get(VIEW_COOKIE_NAME)?.value)

  if (hasViewedPost(viewed, postId)) {
    return
  }

  const supabase = await createClient()
  const { error } = await supabase.rpc('increment_post_view', { p_id: postId })

  if (error !== null) {
    // 조회수는 부가 지표다. 실패해도 화면에 알리지 않고 다음 방문에 다시 시도한다.
    return
  }

  cookieStore.set(VIEW_COOKIE_NAME, serializeViewedPosts(withViewedPost(viewed, postId)), {
    maxAge: VIEW_COOKIE_MAX_AGE,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  })
}
