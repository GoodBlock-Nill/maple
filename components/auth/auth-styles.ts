/**
 * 인증 폼이 공유하는 표면.
 * 고객지원 문의 폼·커뮤니티 글쓰기와 같은 입력 표면(h44 · radius 10 · #cdd3db)을 쓴다.
 */
export const AUTH_FIELD_CLASS =
  'rounded-[10px] border-line-soft text-input placeholder:text-[#9a9a9a]'

/** 글래스 카드. 헤더 바(.glass)와 같은 유리 표면에 패널 라운드를 씌운다. */
export const AUTH_CARD_CLASS = 'glass rounded-panel w-full px-6 py-8 sm:px-10 sm:py-10'

export const AUTH_LINK_CLASS =
  'tap-area text-ink underline underline-offset-4 transition-opacity hover:opacity-70'

/**
 * 입력 표면 h56 — bg #fafafa · border #d5d9df · radius 12.
 *
 * 로그인·회원가입 시안(폐기)에서 왔지만 마이페이지(프로필·쿠폰·비밀번호 변경)가
 * 같은 표면을 쓴다 — 시안 실측값이 같다. 왼쪽 여백은 테두리를 포함해 24px 이어야
 * 해서 padding 은 23px 이다.
 */
export const AUTH_INPUT_CLASS =
  'h-14 w-full rounded-[12px] border border-field-line bg-field pl-[23px] text-input text-ink ' +
  'placeholder:text-[rgba(102,102,102,0.6)] focus-visible:outline-2 focus-visible:outline-offset-0 ' +
  'focus-visible:outline-focus disabled:text-ink read-only:text-ink'
