import type { BadgeColor } from '@/lib/constants/categories'
import type { CommunityCategory, CommunitySort, NewsCategory, NewsView } from '@/types/domain'

/** 목록 한 페이지에 추가로 쌓이는 건수. "더보기"는 1~N 페이지를 누적 표시한다. */
export const BOARD_PAGE_SIZE = 10

export type BoardOption<TValue extends string> = {
  value: TValue
  label: string
}

export type CategoryOption<TValue extends string> = BoardOption<TValue> & {
  /** `BADGE_CLASS` 키. 카테고리 → 뱃지 색 매핑의 단일 출처. */
  badge: BadgeColor
}

export const NEWS_CATEGORIES = [
  { value: 'notice', label: '공지사항', badge: 'notice' },
  { value: 'patch', label: '패치노트', badge: 'patch' },
  { value: 'event', label: '이벤트', badge: 'event' },
] as const satisfies readonly CategoryOption<NewsCategory>[]

export const COMMUNITY_CATEGORIES = [
  { value: 'chat', label: '잡담', badge: 'chat' },
  { value: 'question', label: '질문', badge: 'question' },
  { value: 'info', label: '정보', badge: 'info' },
] as const satisfies readonly CategoryOption<CommunityCategory>[]

/** 라벨은 시안(notice.png) 트리거 표기를 따른다 — 기본값이 "카드형". */
export const NEWS_VIEWS = [
  { value: 'row', label: '가로형' },
  { value: 'detail', label: '자세히' },
  { value: 'tile', label: '카드형' },
] as const satisfies readonly BoardOption<NewsView>[]

export const DEFAULT_NEWS_VIEW: NewsView = 'tile'

export const COMMUNITY_SORTS = [
  { value: 'latest', label: '최신순' },
  { value: 'views', label: '조회순' },
  { value: 'likes', label: '좋아요순' },
] as const satisfies readonly BoardOption<CommunitySort>[]

export const DEFAULT_COMMUNITY_SORT: CommunitySort = 'latest'

/**
 * DB 의 `posts.category_key` 는 FK 로만 강제되고 타입 생성 결과는 평범한 text 다.
 * 매퍼가 알 수 없는 말머리를 만났을 때 떨어뜨릴 자리로 첫 카테고리를 쓴다.
 */
export const DEFAULT_NEWS_CATEGORY: NewsCategory = 'notice'

export const DEFAULT_COMMUNITY_CATEGORY: CommunityCategory = 'chat'

export const NEWS_CATEGORY_VALUES = NEWS_CATEGORIES.map((item) => item.value)

export const COMMUNITY_CATEGORY_VALUES = COMMUNITY_CATEGORIES.map((item) => item.value)

export const NEWS_VIEW_VALUES = NEWS_VIEWS.map((item) => item.value)

export const COMMUNITY_SORT_VALUES = COMMUNITY_SORTS.map((item) => item.value)

/**
 * `noUncheckedIndexedAccess` 아래에서도 `MAP[value]` 가 undefined 로 좁혀지지
 * 않도록 완전한 Record 로 만든다.
 */
function toLookup<TOption extends BoardOption<string>>(
  options: readonly TOption[],
): Record<TOption['value'], TOption> {
  return Object.fromEntries(options.map((option) => [option.value, option])) as Record<
    TOption['value'],
    TOption
  >
}

export const NEWS_CATEGORY_MAP = toLookup(NEWS_CATEGORIES)

export const COMMUNITY_CATEGORY_MAP = toLookup(COMMUNITY_CATEGORIES)

export const NEWS_VIEW_MAP = toLookup(NEWS_VIEWS)

export const COMMUNITY_SORT_MAP = toLookup(COMMUNITY_SORTS)

/** 카테고리 칩 맨 앞의 "전체" 항목 라벨. */
export const ALL_CATEGORY_LABEL = '전체'

/** 인증 연동 전까지 작성 계열 액션에 붙는 안내 문구. */
export const LOGIN_REQUIRED_NOTICE = '로그인 후 작성할 수 있습니다.'
