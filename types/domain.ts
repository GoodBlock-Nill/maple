/**
 * 게시판 도메인 타입.
 *
 * Phase 4에서 Supabase 스키마로 교체될 예정이므로, 컬럼명은 DB 후보명
 * (snake_case → camelCase 매핑)을 그대로 따른다.
 */

/**
 * 뉴스 말머리 6종. `board_categories(board='news').key` 및 카테고리별 배너
 * (`lib/constants/news-banners.ts`)와 1:1 대응한다.
 * 값 `info`(안내사항)는 커뮤니티의 `info`(정보)와 문자열만 같고 다른 게시판이라
 * 뱃지 색은 별도 토큰(`news-info`)을 쓴다.
 */
export type NewsCategory = 'notice' | 'maintenance' | 'update' | 'patch' | 'event' | 'info'

export type CommunityCategory = 'chat' | 'question' | 'info'

/**
 * 본문 저장 형식(`posts.content_format` enum 과 1:1).
 * 에디터 도입 이후 새 글은 항상 `html` 이고, `markdown` 은 그 이전 글이다.
 */
export type ContentFormat = 'markdown' | 'html'

/** 뉴스 목록 표시 방식. URL `?view=` 값과 1:1 대응한다. */
export type NewsView = 'tile' | 'detail' | 'row'

/** 커뮤니티 정렬 기준. URL `?sort=` 값과 1:1 대응한다. */
export type CommunitySort = 'latest' | 'views' | 'likes'

export type NewsItem = {
  id: string
  category: NewsCategory
  title: string
  summary: string
  /** `contentFormat` 에 따라 마크다운 원문이거나 정제를 마친 HTML 이다. */
  body: string
  contentFormat: ContentFormat
  views: number
  /** ISO 8601 문자열. 표시 직전에 `formatDateIso` 로 변환한다. */
  publishedAt: string
  /** 작성자가 본문을 실제로 고친 시각. 한 번도 고치지 않았으면 null 이다. */
  editedAt: string | null
  /** 없으면 목록의 "자세히" 뷰에서 회색 플레이스홀더를 그린다. */
  thumbnail?: string
}

/** 상세의 이전/다음 글 링크에 필요한 최소 필드만 담는다. */
export type AdjacentNewsItem = Pick<NewsItem, 'id' | 'category' | 'title' | 'publishedAt'>

export type AdjacentNews = {
  /** 현재 글보다 먼저 발행된, 가장 가까운 글. 없으면 첫 글이다. */
  prev: AdjacentNewsItem | null
  /** 현재 글보다 나중에 발행된, 가장 가까운 글. 없으면 최신 글이다. */
  next: AdjacentNewsItem | null
}

export type Comment = {
  id: string
  author: string
  body: string
  createdAt: string
  /** 작성자 uuid. 탈퇴하면 null 이 된다(`on delete set null`). 삭제 버튼 노출 판정에만 쓴다. */
  authorId: string | null
}

export type Post = {
  id: string
  category: CommunityCategory
  title: string
  /** `contentFormat` 에 따라 마크다운 원문이거나 정제를 마친 HTML 이다. */
  body: string
  contentFormat: ContentFormat
  /** 원본 닉네임. 화면에는 `maskNickname` 을 거쳐 노출한다. */
  author: string
  /** 작성자 uuid. 탈퇴하면 null 이 된다. 수정·삭제 버튼 노출 판정에만 쓴다. */
  authorId: string | null
  views: number
  likes: number
  createdAt: string
  /**
   * 작성자가 본문을 실제로 고친 시각. 한 번도 고치지 않았으면 null 이다.
   * `updatedAt` 은 조회수 증가로도 밀리므로 "수정됨" 판정에 쓸 수 없다.
   */
  editedAt: string | null
  /**
   * `posts.comment_count` 스냅샷. 목록에서 댓글을 조인하지 않고도 개수를 표시하려고
   * 트리거가 동기화해 주는 값을 그대로 쓴다.
   */
  commentCount: number
  /** 상세에서만 채워진다. 목록 응답에서는 항상 빈 배열이다. */
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

export type GachaSort = 'latest' | 'prob_desc' | 'prob_asc'

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

/* -------------------------------------------------------------------------
 * 사이트 전역 설정 (`site_settings` 단일 행)
 * ---------------------------------------------------------------------- */

export type SiteSettings = {
  gameName: string
  worldId: string | null
  discordUrl: string | null
  youtubeUrl: string | null
  contactEmail: string | null
  ipNotice: string | null
  copyright: string | null
  creatorName: string | null
  creatorSlogan: string | null
  /** 마크다운. 문단 구분은 빈 줄 두 개. */
  creatorIntro: string | null
  creatorPhotoUrl: string | null
}

/* -------------------------------------------------------------------------
 * 1:1 문의 — 내 문의 내역
 * ---------------------------------------------------------------------- */

/** `inquiries.status` (inquiry_status enum) 과 1:1. */
export type InquiryStatus = 'pending' | 'in_progress' | 'answered' | 'closed'

/**
 * `inquiries.attachments` 의 원소.
 * 파일 실체는 비공개 버킷에 있고 DB 에는 이 메타만 남는다(마이그레이션 20260908000400).
 */
export type InquiryAttachment = {
  name: string
  /** 버킷 안 오브젝트 키(`{uid}/{파일명}`). 서명 URL 발급에만 쓴다. */
  path: string
  size: number
  mimeType: string
}

/** 서명 URL 을 붙인 첨부. 발급에 실패하면 `url` 이 null 이고 이름만 노출한다. */
export type SignedInquiryAttachment = InquiryAttachment & {
  url: string | null
}

/**
 * 목록 행. 본문·첨부는 담지 않는다 — 목록에 필요 없고, 개인정보(계정 ID·첨부)를
 * 필요 없는 화면까지 실어 나르지 않는 편이 안전하다.
 */
export type InquirySummary = {
  id: string
  title: string
  /** 자유 문자열. DB 가 text 라 화면도 값을 그대로 쓴다. */
  category: string
  type: string
  status: InquiryStatus
  /**
   * 사용자가 스스로 접수를 취소한 시각. null 이면 취소되지 않았다.
   * 취소는 `status = 'closed'` 로 저장되므로, "종료"와 "접수 취소"는 이 값으로만
   * 구분된다(enum 에 값을 더하지 않은 이유는 마이그레이션 20260908001900 참고).
   */
  cancelledAt: string | null
  createdAt: string
  /** 운영자 답변 수. 목록에서 "답변 완료"를 눈으로 확인하는 보조 지표다. */
  replyCount: number
}

export type InquiryDetail = InquirySummary & {
  /** 접수 당시 입력한 MSW 계정 ID. 화면에는 마스킹해서 그린다. */
  accountId: string | null
  /** 평문. 줄바꿈만 살려서 그린다(마크다운·HTML 을 해석하지 않는다). */
  content: string
  attachments: readonly InquiryAttachment[]
}

export type InquiryReply = {
  id: string
  authorName: string
  content: string
  createdAt: string
}

/* -------------------------------------------------------------------------
 * 히어로 배너 — 홈 히어로의 CTA 아래, 캐릭터를 가리지 않는 띠에 한 장만 노출
 * ---------------------------------------------------------------------- */

export type HeroBannerMediaType = 'image' | 'youtube'

export type HeroBanner = {
  id: string
  title: string
  subtitle: string | null
  mediaType: HeroBannerMediaType
  /** 이미지 배너의 그림. 유튜브 배너에서는 선택적 포스터(썸네일 대체). */
  imageUrl: string | null
  /** 유튜브 배너일 때만. 주소에서 뽑아낸 영상 id. */
  youtubeId: string | null
  linkUrl: string | null
  ctaLabel: string | null
}
