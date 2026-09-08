/** 목록 카드가 공유하는 흰 표면. hover 시 테두리가 진해지며 살짝 떠오른다. */
export const BOARD_CARD_CLASS =
  'rounded-panel border-line-soft bg-surface shadow-chip block border ' +
  'transition-[border-color,transform] duration-150 hover:border-ink/40 hover:-translate-y-0.5'

/** 목록 제목 27px medium (시안 실측: tracking -0.2px, lh 24). */
export const BOARD_TITLE_CLASS =
  'text-ink line-clamp-1 text-[clamp(19px,2vw,27px)] leading-[24px] font-medium tracking-[-0.2px]'

/** 목록 하단 pill 액션(더보기 · 목록으로). */
export const BOARD_PILL_CLASS =
  'cta-more rounded-pill inline-flex h-11 items-center px-[17px] text-[16px] font-medium ' +
  'transition-[filter] hover:brightness-125'
