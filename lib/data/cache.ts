/**
 * 데이터 캐시 태그 · 수명.
 *
 * `next.config.ts` 에 `cacheComponents` 를 켜지 않았으므로 이 프로젝트는
 * 이전 모델(`unstable_cache` + 라우트 세그먼트 `revalidate`)을 쓴다
 * (`node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md`).
 *
 * 여기 담기는 것은 `unstable_cache` 로 감싼 **공개 데이터**뿐이다. 게시글 **상세**와
 * 댓글은 세션 바인딩 클라이언트로 매 요청 읽으므로 태그가 필요 없고, 쓰기 후에는
 * `revalidatePath()` 로 라우트 캐시만 비운다.
 *
 * 목록(커뮤니티 · 뉴스)은 예외다. 누가 보든 결과가 같은 공개 목록이라 익명
 * 클라이언트로 읽어 캐시에 담고, 관리자가 글을 숨기거나 지우면 관리자 앱이
 * `POST /api/revalidate` 로 아래 태그를 태운다. 그러지 않으면 상세는 즉시 404 인데
 * 목록에는 최대 1분간 남아 있는 틈이 생긴다.
 *
 * Next 16 의 `revalidateTag(tag, profile)` 는 두 번째 인자가 필수다(1-인자 형태는
 * 폐기 예정). 관리자 CRUD 가 붙을 때 `revalidateTag(CACHE_TAGS.gacha, 'max')`
 * 형태로 호출한다.
 */
export const CACHE_TAGS = {
  /** 커뮤니티 목록(`getCommunityList`). 운영 숨김 · 삭제를 즉시 반영할 때 태운다. */
  communityList: 'community-list',
  faqs: 'faqs',
  /** 뉴스 목록(`getNewsList`). 발행 · 숨김 · 삭제를 즉시 반영할 때 태운다. */
  newsList: 'news-list',
  gacha: 'gacha',
  rankings: 'rankings',
  site: 'site',
} as const

/** 목록·게시판 계열. 운영자가 글을 올리면 최대 1분 안에 반영된다. */
export const LIST_REVALIDATE_SECONDS = 60

/** FAQ · 사이트 설정처럼 거의 바뀌지 않는 데이터. */
export const STATIC_REVALIDATE_SECONDS = 300
