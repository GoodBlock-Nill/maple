/**
 * 게시판 도메인 타입.
 *
 * Phase 4에서 Supabase 스키마로 교체될 예정이므로, 컬럼명은 DB 후보명
 * (snake_case → camelCase 매핑)을 그대로 따른다.
 */

export type NewsCategory = 'notice' | 'patch' | 'event'

export type CommunityCategory = 'chat' | 'question' | 'info'

/** 뉴스 목록 표시 방식. URL `?view=` 값과 1:1 대응한다. */
export type NewsView = 'tile' | 'detail' | 'row'

/** 커뮤니티 정렬 기준. URL `?sort=` 값과 1:1 대응한다. */
export type CommunitySort = 'latest' | 'views' | 'likes'

export type NewsItem = {
  id: string
  category: NewsCategory
  title: string
  summary: string
  /** 마크다운 본문. */
  body: string
  views: number
  /** ISO 8601 문자열. 표시 직전에 `formatDateIso` 로 변환한다. */
  publishedAt: string
  /** 없으면 목록의 "자세히" 뷰에서 회색 플레이스홀더를 그린다. */
  thumbnail?: string
}

export type Comment = {
  id: string
  author: string
  body: string
  createdAt: string
}

export type Post = {
  id: string
  category: CommunityCategory
  title: string
  body: string
  /** 원본 닉네임. 화면에는 `maskNickname` 을 거쳐 노출한다. */
  author: string
  views: number
  likes: number
  createdAt: string
  comments: readonly Comment[]
}

/**
 * "더보기" 누적 목록의 결과.
 * `shown` 은 현재 화면에 쌓인 개수, `total` 은 필터를 통과한 전체 개수다.
 */
export type ListResult<TItem> = {
  items: readonly TItem[]
  total: number
  shown: number
  page: number
  hasMore: boolean
}

export type NewsListParams = {
  category?: NewsCategory | null
  q?: string
  page?: number
}

export type CommunityListParams = {
  category?: CommunityCategory | null
  sort?: CommunitySort
  q?: string
  page?: number
}

/* -------------------------------------------------------------------------
 * 가이드 — 확률형 아이템 정보
 * ---------------------------------------------------------------------- */

/** 가이드 탭. URL `?tab=` 값과 1:1 대응한다. */
export type GachaTab = 'premium' | 'cube' | 'scroll'

/** 확률 표의 등급. 시안은 SS/S/A 만 쓰지만 B/C 까지 확장해 둔다. */
export type GachaGrade = 'SS' | 'S' | 'A' | 'B' | 'C'

export type GachaSort = 'latest' | 'probability' | 'name'

export type GachaRow = {
  grade: GachaGrade
  itemName: string
  itemIcon: string
  /** 소수점 둘째 자리 문자열. 합계 검증이 필요해질 수 있어 표기 그대로 둔다. */
  probability: string
  note: string
}

export type GachaItem = {
  id: string
  tab: GachaTab
  name: string
  icon: string
  /** 대표 확률("0.01"). 화면에는 `%` 를 붙여 노출한다. */
  probability: string
  /** ISO 8601 갱신일. */
  updatedAt: string
  rows: readonly GachaRow[]
}

export type GachaListParams = {
  tab?: GachaTab
  sort?: GachaSort
  q?: string
  page?: number
}

/* -------------------------------------------------------------------------
 * 랭킹
 * ---------------------------------------------------------------------- */

/** 랭킹 종류. URL `?type=` 값과 1:1 대응한다. */
export type RankingType = 'total' | 'job' | 'guild'

/** 직업군. URL `?job=` 값과 1:1 대응하며 없으면 "전체 직업". */
export type JobGroup = 'adventurer' | 'cygnus' | 'resistance' | 'hero' | 'demon'

export type RankingEntry = {
  id: string
  /** 원본 닉네임. 화면에는 `maskNickname` 을 거쳐 노출한다. */
  nickname: string
  level: number
  job: string
  jobGroup: JobGroup
  /** "98.7B" 처럼 이미 축약된 표기. */
  exp: string
  guild: string | null
  /** TOP3 카드에 쓰는 캐릭터 일러스트. 없으면 실루엣 플레이스홀더. */
  character?: string
}

export type RankedEntry = RankingEntry & { rank: number }

export type RankingListParams = {
  type?: RankingType
  job?: JobGroup | null
  q?: string
  page?: number
}

export type RankingListResult = {
  /** 1~3위 카드. 결과가 3건 미만이면 그만큼만 채워진다. */
  top: readonly RankedEntry[]
  /** 4위부터의 표 행(누적). */
  rows: readonly RankedEntry[]
  total: number
  shown: number
  page: number
  hasMore: boolean
}

/* -------------------------------------------------------------------------
 * 고객지원
 * ---------------------------------------------------------------------- */

export type FaqCategory = 'notice' | 'account' | 'payment' | 'bug' | 'etc'

export type FaqItem = {
  id: string
  category: FaqCategory
  question: string
  answer: string
}

export type FaqGroup = {
  category: FaqCategory
  label: string
  items: readonly FaqItem[]
}
