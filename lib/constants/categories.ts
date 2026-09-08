/**
 * 게시판 카테고리 뱃지 색상 토큰.
 *
 * Tailwind v4는 클래스 문자열을 정적으로 스캔하므로 `bg-badge-${color}` 같은
 * 동적 보간을 감지하지 못한다. 반드시 완전한 클래스 문자열을 값으로 둔다.
 *
 * 전경색은 각 배경 대비 WCAG AA(4.5:1)를 만족하는 쪽으로 선택했다.
 * ink(#2a2a2a) 기준 red 5.5 / pink 8.2 / orange 9.4 / green 8.3 / rose 11.2
 */
export type BadgeColor =
  | 'red'
  | 'pink'
  | 'purple'
  | 'orange'
  | 'green'
  | 'rose'
  | 'gray'
  /* 게시판 말머리 9종 — lib/constants/board.ts 의 카테고리와 1:1 대응한다. */
  | 'notice'
  | 'maintenance'
  | 'update'
  | 'patch'
  | 'event'
  /* 뉴스 "안내사항". 커뮤니티 'info'(정보)가 이미 초록을 쓰고 있어 키를 분리한다. */
  | 'news-info'
  | 'chat'
  | 'question'
  | 'info'

export const BADGE_CLASS: Record<BadgeColor, string> = {
  red: 'bg-badge-red text-ink',
  pink: 'bg-badge-pink text-ink',
  purple: 'bg-badge-purple text-white',
  orange: 'bg-badge-orange text-ink',
  green: 'bg-badge-green text-ink',
  rose: 'bg-badge-rose text-ink',
  gray: 'bg-badge-gray text-white',

  /* 뉴스 — 배너(public/images/news/banners)의 주조색과 맞춘다. */
  notice: 'bg-tag-purple-bg text-tag-purple',
  maintenance: 'bg-tag-blue-bg text-tag-blue',
  update: 'bg-tag-cyan-bg text-tag-cyan',
  patch: 'bg-tag-orange-bg text-tag-orange',
  event: 'bg-tag-green-bg text-tag-green',
  'news-info': 'bg-tag-pink-bg text-tag-pink',

  /* 커뮤니티 — 잡담은 공지사항, 정보는 이벤트와 같은 색을 공유한다(시안 기준). */
  chat: 'bg-tag-purple-bg text-tag-purple',
  question: 'bg-tag-blue-bg text-tag-blue',
  info: 'bg-tag-green-bg text-tag-green',
}

/** 뱃지 라벨과 색상 매핑. 추후 DB(categories)로 이관될 기본값. */
export const CATEGORY_BADGES = [
  { label: '필독', color: 'red' },
  { label: '점검', color: 'pink' },
  { label: '공지사항', color: 'purple' },
  { label: '업데이트', color: 'orange' },
  { label: '상시진행', color: 'green' },
  { label: '종료', color: 'rose' },
  { label: '제재', color: 'gray' },
] as const satisfies readonly { label: string; color: BadgeColor }[]
