/**
 * 카드형·리스트형 뉴스 목록 공용 클래스(시안 v2 §2·§3·§5).
 *
 * 표면(테두리·그림자·hover 반응)은 `board-styles.ts` 의 `BOARD_CARD_CLASS` 와
 * 같은 값을 **복사**해 둔다. 리스트형(`NewsRow`)이 요약 줄만 빼고 카드형과 같은
 * 표면·패딩·gap 을 그대로 쓰므로(시안 v2 §5), 두 뷰가 이 파일을 함께 쓴다.
 */
const NEWS_CARD_SURFACE_CLASS =
  'rounded-panel border-line-soft bg-surface shadow-chip block border ' +
  'transition-[border-color,transform] duration-150 hover:border-ink/40 hover:-translate-y-0.5'

/** 카드 1장 — padding 24(lg 미만 20) · 세로 gap 24 · 행 안에서 stretch. */
export const NEWS_CARD_CLASS = NEWS_CARD_SURFACE_CLASS + ' flex h-full flex-col gap-6 p-5 lg:p-6'

/** 2열 grid(열 폭 574) · gap 16. lg 미만은 1열. */
export const NEWS_CARD_GRID_CLASS = 'grid grid-cols-1 gap-4 lg:grid-cols-2'

/** 머리줄 — 좌측 말머리 뱃지, 우측 고정 핀. */
export const NEWS_CARD_HEAD_CLASS = 'flex items-start justify-between gap-3'

/** 제목·요약 묶음(gap 8). */
export const NEWS_CARD_BODY_CLASS = 'flex flex-col gap-2'

/** 제목 27/24 tracking -0.2, 한 줄 말줄임(lg 미만 22). */
export const NEWS_CARD_TITLE_CLASS =
  'text-ink line-clamp-1 text-[22px] leading-[24px] font-medium tracking-[-0.2px] lg:text-[27px]'

/**
 * 요약 17/25 2줄 클램프(lg 미만 16/24). 색은 시안 #727272 대신 `text-ink-muted`
 * (#737373)를 쓴다 — 눈으로 구분되지 않는 1단계 차이라 토큰을 유지하는 편이 낫다.
 */
export const NEWS_CARD_SUMMARY_CLASS =
  'text-ink-muted line-clamp-2 text-[16px] leading-[24px] font-medium lg:text-[17px] lg:leading-[25px]'

/** 리스트형(§5) 행 사이 gap 16(현행 카드형과 달리 1열이라 grid 대신 flex 로 쌓는다). */
export const NEWS_ROW_LIST_CLASS = 'flex flex-col gap-4'
