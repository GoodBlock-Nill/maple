/**
 * 조회수 중복 집계 방지.
 *
 * 게시글마다 쿠키를 하나씩 굽는 방식은 목록을 돌아다니는 것만으로 쿠키가 무한히
 * 늘어나 요청 헤더가 커진다. 그래서 최근 본 글 id 를 **하나의 쿠키에 상한을 두고**
 * 담는다. 상한을 넘으면 가장 오래된 항목부터 밀려나므로 헤더 크기가 고정된다.
 */

export const VIEW_COOKIE_NAME = 'viewed_posts'

/** 24시간. */
export const VIEW_COOKIE_MAX_AGE = 60 * 60 * 24

/** 쿠키에 담을 최대 개수. uuid 36자 × 40 ≈ 1.5KB 로 헤더 한도 안에 든다. */
export const VIEW_COOKIE_CAPACITY = 40

const SEPARATOR = ','

/** uuid 형식이 아닌 값은 애초에 담지도, 조회하지도 않는다. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isPostId(value: string): boolean {
  return UUID_PATTERN.test(value)
}

export function parseViewedPosts(raw: string | undefined): readonly string[] {
  if (raw === undefined || raw.length === 0) {
    return []
  }

  return raw.split(SEPARATOR).filter(isPostId).slice(0, VIEW_COOKIE_CAPACITY)
}

export function hasViewedPost(viewed: readonly string[], postId: string): boolean {
  return viewed.includes(postId)
}

/** 방금 본 글을 맨 앞에 두고 상한을 넘는 오래된 항목을 잘라 낸다. */
export function withViewedPost(viewed: readonly string[], postId: string): readonly string[] {
  return [postId, ...viewed.filter((id) => id !== postId)].slice(0, VIEW_COOKIE_CAPACITY)
}

export function serializeViewedPosts(viewed: readonly string[]): string {
  return viewed.join(SEPARATOR)
}
