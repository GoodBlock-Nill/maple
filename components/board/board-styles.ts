/** 목록 카드가 공유하는 흰 표면. hover 시 테두리가 진해지며 살짝 떠오른다. */
export const BOARD_CARD_CLASS =
  'rounded-panel border-line-soft bg-surface shadow-chip block border ' +
  'transition-[border-color,transform] duration-150 hover:border-ink/40 hover:-translate-y-0.5'

/**
 * 목록 행 공통 골격(뉴스 실측 기준): 수직 패딩 12 · 수평 패딩 24 · 줄 간격 6.
 * 커뮤니티 목록도 이 값을 그대로 써서 두 목록의 행 높이가 어긋나지 않게 한다.
 */
export const BOARD_ROW_CLASS = BOARD_CARD_CLASS + ' flex flex-col gap-1.5 px-6 py-3'

/** 목록 제목 20px medium (뉴스 실측: tracking -0.2px). 뉴스·커뮤니티 공용. */
export const BOARD_ROW_TITLE_CLASS =
  'text-ink line-clamp-1 text-[20px] font-medium tracking-[-0.2px]'

/**
 * 행 2번째 줄의 보조 텍스트(댓글수 · 마스킹된 작성자).
 * MetaRow와 동일한 16px/leading-19px를 써서 한 줄 높이가 어긋나지 않게 한다.
 */
export const BOARD_ROW_META_CLASS = 'text-ink-muted text-[16px] leading-[19px] font-medium'

/** 목록 하단 pill 액션(더보기 · 목록으로). */
export const BOARD_PILL_CLASS =
  'cta-more rounded-pill inline-flex h-11 items-center px-[17px] text-[16px] font-medium ' +
  'transition-[filter] hover:brightness-125'

/**
 * 상세 헤더의 작은 액션(수정 · 삭제 · 신고).
 * 본문보다 한 단계 물러난 muted 톤이고, hover/focus 에서만 잉크색으로 올라온다.
 */
export const BOARD_ACTION_CLASS =
  'border-line-soft text-ink-muted rounded-pill inline-flex h-8 items-center border bg-white ' +
  'px-3 text-[14px] font-medium whitespace-nowrap transition-colors hover:border-ink/40 ' +
  'hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:pointer-events-none disabled:opacity-50'

/** 확인 모달의 파괴적 확인 버튼(삭제). */
export const BOARD_DANGER_CLASS =
  'cta-dark rounded-pill inline-flex h-11 items-center px-5 text-[15px] font-semibold ' +
  'transition-[filter] hover:brightness-125 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50'
