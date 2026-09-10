/**
 * 로그인·회원가입 시안(Figma 2041:2289 / 2041:2365)의 표면값.
 *
 * 1440 기준 실측값을 그대로 박는다 — 카드 860/794, 폼 580, 입력 h56, 버튼 h64.
 * 640px 미만에서만 가로폭·글자 크기가 줄고 세로 리듬은 유지한다.
 * 측정 근거: `docs/reference/figma/auth-spec.md`.
 */

/**
 * 본문 섹션 높이 = 푸터 섹션이 시작하는 y(1440 기준 시안 실측).
 * 로그인 프레임 1862 − 푸터 668 = 1194, 회원가입 2006 − 668 = 1338.
 */
export const LOGIN_SCENE_HEIGHT = 1194
export const SIGNUP_SCENE_HEIGHT = 1338

/* -------------------------------------------------------------------------- */
/* 카드                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 외곽 글래스 860 — 헤더 바(.glass)보다 옅은 30% 흰색이다.
 *
 * 시안의 padding 32 는 테두리를 **덮는** 값이다(Figma 스트로크는 프레임 안쪽에
 * 그려진다). 세로는 31+1 로 맞춰야 안쪽 카드 상단이 시안의 y=255 에 앉고,
 * 가로는 32+1 이어야 안쪽 카드가 x=323 · 폭 794 가 된다.
 */
export const AUTH_CARD_OUTER_CLASS =
  'w-full max-w-[860px] rounded-[20px] border border-white bg-white/30 p-4 backdrop-blur-[7.5px] sm:px-8 sm:py-[31px] ' +
  'shadow-[inset_0_0_33px_rgba(255,255,255,0.4),0_0.326px_0.733px_rgba(0,0,0,0.12),0_1.541px_2.867px_rgba(0,0,0,0.07)]'

/** 내부 흰 카드 794 — 세로 패딩 70(테두리 1 포함), 가운데 정렬. */
export const AUTH_CARD_INNER_CLASS =
  'flex w-full flex-col items-center gap-8 rounded-[20px] border border-line-soft bg-white px-5 py-10 sm:gap-10 sm:px-8 sm:py-[69px] ' +
  'shadow-[0_0.326px_0.367px_rgba(0,0,0,0.12),0_1.541px_1.433px_rgba(0,0,0,0.07)]'

/** 제목 — Switzer Semibold 40 #333. 줄 높이는 시안 실측(49px). */
export const AUTH_TITLE_CLASS =
  'text-center text-[28px] leading-[36px] font-semibold text-[#333] sm:text-[40px] sm:leading-[49px]'

/** 폼 폭 580. 카드 안에서 가운데 정렬된다. */
export const AUTH_FORM_CLASS = 'flex w-full max-w-[580px] flex-col'

/* -------------------------------------------------------------------------- */
/* 필드                                                                        */
/* -------------------------------------------------------------------------- */

/** 라벨 — Medium 17 #2a2a2a, 라벨↔입력 gap 10. */
export const AUTH_LABEL_CLASS = 'block text-ui leading-[27px] font-medium text-ink'

/**
 * 입력 h56 — bg #fafafa · border #d5d9df · radius 12.
 * 왼쪽 여백은 테두리를 포함해 24px 이어야 해서 padding 은 23px 이다.
 */
export const AUTH_INPUT_CLASS =
  'h-14 w-full rounded-[12px] border border-field-line bg-field pl-[23px] text-input text-ink ' +
  'placeholder:text-[rgba(102,102,102,0.6)] focus-visible:outline-2 focus-visible:outline-offset-0 ' +
  'focus-visible:outline-focus disabled:text-ink read-only:text-ink'

/** 오류 문구 — 입력 아래 3px, 14px #ee1d52. */
export const AUTH_ERROR_CLASS = 'mt-[3px] text-[14px] leading-[21px] text-[#ee1d52]'

/** 안내(성공) 문구 — 오류와 같은 자리, 색만 다르다. */
export const AUTH_NOTICE_CLASS = 'mt-[3px] text-[14px] leading-[21px] text-[#0067ff]'

/* -------------------------------------------------------------------------- */
/* 버튼                                                                        */
/* -------------------------------------------------------------------------- */

const BUTTON_BASE =
  'flex w-full items-center justify-center font-semibold text-white transition-opacity ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-25'

/** 제출 버튼 580×64 radius 32 (#111 로그인 / #2a2a2a 가입하기). */
export const AUTH_SUBMIT_CLASS = `${BUTTON_BASE} h-16 rounded-[32px] bg-[#111] text-[16px] sm:text-[18px]`
export const AUTH_SUBMIT_DARK_CLASS = `${BUTTON_BASE} h-16 rounded-[32px] bg-ink text-[16px] sm:text-[18px]`

/** 이메일 행 오른쪽의 보조 버튼 135×56 radius 12. */
export const AUTH_INLINE_BUTTON_CLASS = `${BUTTON_BASE} h-14 w-[120px] shrink-0 rounded-[12px] text-[15px] sm:w-[135px] sm:text-[16px]`

/** 간편로그인 580×64 pill — 아이콘과 문구 사이 16. */
export const AUTH_SOCIAL_CLASS = `${BUTTON_BASE} h-16 gap-4 rounded-[50px] bg-ink text-[16px] sm:text-[18px]`

/* -------------------------------------------------------------------------- */
/* 보조 링크                                                                   */
/* -------------------------------------------------------------------------- */

/** "회원가입 | 비밀번호 찾기" · "계정이 이미 있으신가요?" — Medium 17 #666. */
export const AUTH_MUTED_LINK_CLASS =
  'text-ui font-medium text-[#666] transition-opacity hover:opacity-70'

/** "비밀번호를 잊으셨나요" — Regular 16 #111 underline. */
export const AUTH_FORGOT_LINK_CLASS =
  'text-[15px] leading-[21px] text-[#111] underline underline-offset-2 sm:text-[16px]'

/** 시안의 파란 "로그인" 링크(#0067ff). */
export const AUTH_ACCENT_LINK_CLASS =
  'inline-flex items-center gap-0.5 text-ui font-medium text-[#0067ff] transition-opacity hover:opacity-70'
