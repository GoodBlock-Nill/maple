/** 고객지원 폼의 필드 공통 표면(시안: bg #fafafa · border #d5d9df · shadow-chip). */
export const SUPPORT_FIELD_CLASS =
  'support-field w-full text-input outline-none focus-visible:outline-2 ' +
  'focus-visible:outline-offset-0 focus-visible:outline-focus'

/** 단일 줄 입력(h40). ID 필드만 pill, 나머지는 radius 20. */
export const SUPPORT_INPUT_CLASS = `${SUPPORT_FIELD_CLASS} rounded-panel h-10 px-4`

export const SUPPORT_LABEL_CLASS = 'text-ink text-ui font-medium'

/**
 * 카드 자체(시안 v2: white · border #cdd3db · radius 20 · shadow-chip · padding 32).
 *
 * 모바일은 12 다 — 카드 안쪽 콘텐츠가 319 로 좁아 32 를 유지하면 본문이 두 글자씩
 * 접힌다(시안 m-1~m-4 도 12).
 */
export const SUPPORT_CARD_CLASS =
  'rounded-panel border-line-soft shadow-chip border bg-white p-3 sm:p-6 lg:p-8'

/**
 * 체크박스 상자 자리(시안 v2: 18×18). 크기는 사용처에서 덮어쓸 수 있다.
 *
 * `relative` 인 이유는 켜졌을 때 입력 위에 체크 그림을 겹쳐 얹기 때문이다
 * (`SupportCheckbox`). `inline-flex` 는 라벨과 같은 줄에서 상자가 글줄 높이에
 * 눌리지 않게 한다.
 */
export const SUPPORT_CHECKBOX_BOX_CLASS = 'relative inline-flex size-[18px] shrink-0'

/**
 * 체크박스 상자 그 자체(시안 v2: border `#d5d9df` · radius 4 · 켜짐 `#2a2a2a`).
 *
 * 네이티브 입력이 그대로 보이는 상자다 — 숨기지 않으므로 클릭 지점과 그림이
 * 어긋나지 않는다. 켜짐 표시(흰 체크)는 `SupportCheckbox` 가 위에 얹는다.
 */
export const SUPPORT_CHECKBOX_INPUT_CLASS =
  'size-full cursor-pointer appearance-none rounded-[4px] border border-[#d5d9df] ' +
  'bg-white checked:border-[#2a2a2a] checked:bg-[#2a2a2a] focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus'

/**
 * 상세 · 수정 화면 맨 위의 뒤로 가기 링크(시안 v2: arrow 24 + gap 4 + 18/26).
 * 모바일은 arrow 20 + 15/22 다.
 */
export const SUPPORT_BACK_LINK_CLASS =
  'text-ink inline-flex items-center gap-1 text-[15px] leading-[22px] font-medium ' +
  'transition-opacity hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-focus lg:text-[18px] lg:leading-[26px]'

/**
 * 상세 헤더의 소유자 액션(수정 · 접수 취소) 공통 골격.
 * 시안 v2: PC h36 · 16 semibold, 모바일 h28 · 13.
 */
const SUPPORT_ACTION_BASE_CLASS =
  'rounded-pill inline-flex items-center justify-center px-3 text-[13px] font-semibold ' +
  'whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-focus disabled:pointer-events-none disabled:opacity-50 ' +
  'h-7 lg:h-9 lg:text-[16px]'

/** 수정 — 흰 알약(시안 60×36). */
export const SUPPORT_ACTION_EDIT_CLASS =
  `${SUPPORT_ACTION_BASE_CLASS} border-line-soft border bg-white text-[#727272] ` +
  'hover:text-ink hover:border-ink/40 lg:min-w-[60px]'

/** 접수 취소 — 회색 알약에 붉은 글자(되돌릴 수 없는 동작이라 톤이 다르다). */
export const SUPPORT_ACTION_CANCEL_CLASS = `${SUPPORT_ACTION_BASE_CLASS} bg-[#f1f1f5] text-[#852221] hover:brightness-95 lg:px-[15px]`

/** 본문·답변이 쓰는 회색 상자(시안 v2: bg #fafafa · radius 16 · padding 24). */
export const SUPPORT_BOX_CLASS = 'bg-page-sub rounded-[16px] px-4 py-3 lg:p-6'

/**
 * 파일 칩(선택한 파일 · 기존 첨부 · 영상 공통).
 * 시안 v2: white · border #cdd3db · radius 100 · px12 py4.
 */
export const SUPPORT_CHIP_CLASS =
  'border-line-soft rounded-pill inline-flex max-w-full items-center border bg-white px-3 py-1'
