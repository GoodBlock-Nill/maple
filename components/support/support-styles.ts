/** 고객지원 폼의 필드 공통 표면(시안: bg #fafafa · border #d5d9df · shadow-chip). */
export const SUPPORT_FIELD_CLASS =
  'support-field w-full text-input outline-none focus-visible:outline-2 ' +
  'focus-visible:outline-offset-0 focus-visible:outline-focus'

/** 단일 줄 입력(h40). ID 필드만 pill, 나머지는 radius 20. */
export const SUPPORT_INPUT_CLASS = `${SUPPORT_FIELD_CLASS} rounded-panel h-10 px-4`

export const SUPPORT_LABEL_CLASS = 'text-ink text-ui font-medium'

/** 카드 자체(시안: white · border #cdd3db · radius 20 · shadow-chip). */
export const SUPPORT_CARD_CLASS =
  'rounded-panel border-line-soft shadow-chip border bg-white ' +
  'px-5 py-8 sm:px-8 lg:pt-[27px] lg:pr-6 lg:pb-8 lg:pl-8'

/**
 * 체크박스 상자 자리(시안: 30×30). 크기는 사용처에서 덮어쓸 수 있다.
 *
 * `relative` 인 이유는 켜졌을 때 입력 위에 체크 그림을 겹쳐 얹기 때문이다
 * (`SupportCheckbox`). `inline-flex` 는 라벨과 같은 줄에서 상자가 글줄 높이에
 * 눌리지 않게 한다.
 */
export const SUPPORT_CHECKBOX_BOX_CLASS = 'relative inline-flex size-[30px] shrink-0'

/**
 * 체크박스 상자 그 자체(시안: border 1.5 `#d5d9df` · radius 5 · 켜짐 `#2a2a2a`).
 *
 * 네이티브 입력이 그대로 보이는 상자다 — 숨기지 않으므로 클릭 지점과 그림이
 * 어긋나지 않는다. 켜짐 표시(흰 체크)는 `SupportCheckbox` 가 위에 얹는다.
 */
export const SUPPORT_CHECKBOX_INPUT_CLASS =
  'size-full cursor-pointer appearance-none rounded-[5px] border-[1.5px] border-[#d5d9df] ' +
  'bg-white checked:border-[#2a2a2a] checked:bg-[#2a2a2a] focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus'
