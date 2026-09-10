/**
 * 마이페이지 시안(Figma 2041:2958 · 2041:3128 · 2041:3237)의 표면값.
 *
 * 1440 기준 실측값을 그대로 박는다. 근거는 `docs/reference/figma/mypage-spec.md`
 * 이고, 아래 숫자들은 시안 PNG 를 1440 으로 되돌려 픽셀로 다시 잰 값이다.
 *
 *   카드 상단 462 → (border 1 + padding 32) → 제목 박스 495, line 24
 *   → gap 32 → 라벨 박스(line 22) → gap 10 → 입력 h56 → gap 32 → 다음 블록
 *
 * 입력 표면 자체는 로그인·회원가입 시안과 같은 값이라(#fafafa · #d5d9df · h56 ·
 * radius 12) `components/auth/auth-styles.ts` 의 `AUTH_INPUT_CLASS` 를 그대로 쓴다 — 두 벌로
 * 나누면 한쪽만 고쳐지는 날이 온다.
 */

/**
 * 본문이 푸터 배경을 덮는 높이.
 *
 * 시안 세 장 모두 "마지막 카드 아래 = 푸터 배경 상단 + 32" 이고, 구분선과 회원
 * 탈퇴 블록(합계 143)이 그 위에 겹쳐 앉는다 → 143 + 32 = 175.
 * `MyPageShell` 의 배경 레이어 높이와 푸터 음수 마진이 이 값을 함께 쓴다.
 */
export const MYPAGE_FOOTER_OVERLAP = 175

/** 1440 기준 골격 — 컨테이너 1200 = 사이드바 268 + gap 32 + 콘텐츠 900. */
export const MYPAGE_SIDEBAR_WIDTH = 268
export const MYPAGE_CONTENT_WIDTH = 900

/* -------------------------------------------------------------------------- */
/* 카드                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * 콘텐츠 카드 900 — bg white · border #cdd3db · radius 20 · padding 32/24.
 * 블록 사이 간격(32)은 `gap-8` 로 준다. 카드의 직계 자식 하나 = 시안의 한 블록.
 */
export const MYPAGE_CARD_CLASS =
  'shadow-chip border-line-soft flex w-full flex-col gap-8 rounded-[20px] border bg-white px-5 py-8 sm:px-6'

/** 카드 제목 — Medium 27 / line 24 / tracking −0.2. */
export const MYPAGE_CARD_TITLE_CLASS =
  'text-ink text-[22px] leading-[24px] font-medium tracking-[-0.2px] sm:text-[27px]'

/* -------------------------------------------------------------------------- */
/* 필드                                                                        */
/* -------------------------------------------------------------------------- */

/** 라벨 — Medium 17 / line 22. 라벨↔입력 10px 은 `AccountField` 가 준다. */
export const MYPAGE_LABEL_CLASS = 'text-ink block text-ui leading-[22px] font-medium'

/** 입력 아래 도움말 — Regular 17 rgba(102,102,102,.6) / line 21. */
export const MYPAGE_HELP_CLASS = 'text-ui leading-[21px] text-[rgba(102,102,102,0.6)]'

/** 프로필 안내문 — 도움말과 같은 색이지만 굵기가 Medium 이다(시안 실측). */
export const MYPAGE_HINT_CLASS = `${MYPAGE_HELP_CLASS} font-medium`

/** 오류 문구 — 인증 화면과 같은 자리·색. */
export const MYPAGE_ERROR_CLASS = 'mt-[3px] text-[14px] leading-[21px] text-[#ee1d52]'

/** 성공·진행 안내. */
export const MYPAGE_NOTICE_CLASS = 'mt-[3px] text-[14px] leading-[21px] text-[#0067ff]'

/* -------------------------------------------------------------------------- */
/* 버튼                                                                        */
/* -------------------------------------------------------------------------- */

const BUTTON_BASE =
  'inline-flex items-center justify-center gap-[10px] font-semibold text-white transition-opacity ' +
  'hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-40'

/** 카드 하단 제출 버튼 135×56 radius 12 (#2a2a2a). */
export const MYPAGE_SUBMIT_CLASS = `${BUTTON_BASE} bg-ink h-14 w-[135px] shrink-0 rounded-[12px] text-[16px]`

/** "이미지 업로드" — padding 15 · gap 10 · 아이콘 24 + Semibold 16. */
export const MYPAGE_UPLOAD_CLASS = `${BUTTON_BASE} bg-ink self-start rounded-[12px] px-[15px] py-[15px] text-[16px]`

/* -------------------------------------------------------------------------- */
/* 사이드바                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * 탭 한 칸 — padding 10 · gap 10 · radius 10.
 *
 * 비활성 탭도 **투명 테두리**를 갖는다. 활성 탭에서만 border 를 켜면 1px 만큼
 * 아이콘이 밀려 탭을 옮길 때마다 글자가 흔들린다.
 */
export const MYPAGE_TAB_CLASS =
  'flex items-center gap-[10px] rounded-[10px] border border-transparent p-[10px] transition-colors'

export const MYPAGE_TAB_ACTIVE_CLASS = 'border-line-soft shadow-chip bg-white'

/** 아이콘 박스 48 — white · border #cdd3db · radius 5 · shadow 0 2 7 rgba(0,0,0,.25). */
export const MYPAGE_TAB_ICON_BOX_CLASS =
  'border-line-soft flex size-12 shrink-0 items-center justify-center rounded-[5px] border bg-white ' +
  'shadow-[0_2px_7px_rgba(0,0,0,0.25)]'

/** 탭 라벨 — Medium 20 / tracking −0.2. */
export const MYPAGE_TAB_LABEL_CLASS =
  'text-ink text-label-lg leading-none font-medium tracking-[-0.2px] whitespace-nowrap'

/** 탭 묶음 아래 사용자 행의 구분선 색(시안 실측 #e2e8f0). */
export const MYPAGE_DIVIDER_CLASS = 'border-0 border-t border-[#e2e8f0]'
