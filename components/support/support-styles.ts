/** 고객지원 폼의 필드 공통 표면(시안: bg #fafafa · border #d5d9df · shadow-chip). */
export const SUPPORT_FIELD_CLASS =
  'support-field w-full text-[17px] outline-none focus-visible:outline-2 ' +
  'focus-visible:outline-offset-0 focus-visible:outline-focus'

/** 단일 줄 입력(h40). ID 필드만 pill, 나머지는 radius 20. */
export const SUPPORT_INPUT_CLASS = `${SUPPORT_FIELD_CLASS} rounded-panel h-10 px-4`

export const SUPPORT_LABEL_CLASS = 'text-ink text-[17px] font-medium'

/** 카드 자체(시안: white · border #cdd3db · radius 20 · shadow-chip). */
export const SUPPORT_CARD_CLASS =
  'rounded-panel border-line-soft shadow-chip border bg-white ' +
  'px-5 py-8 sm:px-8 lg:py-8 lg:pr-6 lg:pl-8'
