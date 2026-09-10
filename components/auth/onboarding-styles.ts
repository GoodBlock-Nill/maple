/**
 * 회원가입(온보딩) v2 시안의 표면 — `docs/reference/figma/auth-v2-spec.md`
 * "회원가입(온보딩) v2 시안" 실측값이다.
 *
 * 1440 기준: 카드 600×656 @ (420,200) · 안쪽 폭 536 · 세로 리듬 32.
 * 390(시안 375) 기준: 카드 343 @ (16,132) · 안쪽 폭 279 · 세로 리듬 24.
 * 두 값이 배수 관계가 아니라 Tailwind 기본 스케일로는 못 맞춘다 — 실측값을 그대로 박는다.
 */

/** 카드 세 겹 그림자(시안 drop-shadow). 로그인 버튼과 같은 값이다. */
const CARD_SHADOW =
  'shadow-[0_0.326px_0.367px_rgba(0,0,0,0.12),0_1.541px_1.433px_rgba(0,0,0,0.07),0_4px_4.5px_rgba(0,0,0,0.05)]'

const CARD_SURFACE = `w-full rounded-[20px] border border-[#ebedf1] bg-white ${CARD_SHADOW}`

/**
 * 입력 카드. 폰 패딩은 좌우 32 · 위 28 · 아래 24(시안 27:5256 실측), PC 는 32 다.
 *
 * 실제 값에서 1 을 뺀 이유: Figma 의 스트로크는 프레임 바깥에 그려져 안쪽 폭을
 * 줄이지 않지만, CSS 의 `border` 는 border-box 안쪽을 1px 먹는다. 그대로 32 를
 * 주면 카드 안 내용이 통째로 1px 씩 밀려 안쪽 폭도 534(시안 536)가 된다.
 */
export const ONBOARDING_CARD_CLASS = `${CARD_SURFACE} px-[31px] pt-[27px] pb-[23px] md:p-[31px]`

/** 실패 카드(27:5161·27:5337)는 폰도 패딩 32 다(테두리 1 을 뺀 31). */
export const ONBOARDING_FAILURE_CARD_CLASS = `${CARD_SURFACE} p-[31px]`

/**
 * 카드를 앉히는 본문 열.
 *
 * 폰은 `max-w-[375px] px-4` 로 시안 폭 343 을 만든다(390 실기기에서도 같다).
 * PC 아래 여백 106 은 "카드 아래 → 푸터 시작(y=962)"의 거리다 — 이 값이 맞아야
 * 1440 에서 푸터가 시안 자리에 선다.
 */
export const ONBOARDING_PAGE_CLASS =
  'font-ui mx-auto w-full max-w-[375px] px-4 pt-[132px] pb-24 md:max-w-[600px] md:px-0 md:pt-[200px] md:pb-[106px]'

/** 실패 화면은 카드가 더 작고 더 아래에서 시작한다(카드 510 @ (465,270), 푸터 y=918). */
export const ONBOARDING_FAILURE_PAGE_CLASS =
  'font-ui mx-auto w-full max-w-[375px] px-4 pt-[196px] pb-24 md:max-w-[510px] md:px-0 md:pt-[270px] md:pb-[330px]'

/**
 * 입력 표면 h54(폰 42) — 시안 Input_Default. 테두리 색은 상태마다 달라서
 * (기본 #cdd3db · 입력됨 #111 · 오류 #852221) 여기에 넣지 않는다.
 * 오른쪽 여백 48 은 지우기 아이콘 20 + 좌우 간격(12·16) 자리다.
 */
export const ONBOARDING_INPUT_CLASS =
  'h-[42px] w-full rounded-[10px] border bg-white pl-4 pr-12 text-[16px] leading-[22px] ' +
  'font-medium tracking-[-0.4px] text-[#2a2a2a] placeholder:text-[#a5adb8] ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:h-[54px]'

export const ONBOARDING_LABEL_CLASS =
  'block text-[14px] leading-[20px] font-medium tracking-[-0.35px] text-[#1e2938]'

/** 입력 아래 도움말(gap 6). 오류일 때만 색이 #852221 로 바뀐다. */
export const ONBOARDING_HINT_CLASS =
  'mt-1.5 text-[12px] leading-[1.45] font-medium tracking-[-0.3px]'

/**
 * 체크박스 22(폰 18) 자리. 그림(`OnboardingCheckbox`)은 리액트 상태로 그린다.
 *
 * 네이티브 입력을 지우지 않고 투명하게 덮는다 — 폼 제출·포커스·스크린리더가
 * 그대로 동작하고, 클릭 지점도 22×22 그대로 남는다(`sr-only` 는 1px 로 줄어
 * 다른 요소에 가린다).
 */
export const CHECKBOX_BOX_CLASS = 'relative inline-flex size-[18px] shrink-0 md:size-[22px]'

export const CHECKBOX_INPUT_CLASS =
  'absolute inset-0 z-10 size-full cursor-pointer appearance-none rounded-[4px] opacity-0 ' +
  'focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

/** 약관 한 줄. 행 높이는 화살표 아이콘 크기(PC 24 · 폰 20)가 정한다. */
export const CONSENT_ROW_CLASS = 'flex h-5 items-center md:h-6'

export const CONSENT_TEXT_CLASS =
  'text-[14px] leading-[20px] font-medium tracking-[-0.4px] text-[#2a2a2a] md:text-[16px] md:leading-[22px]'

const BUTTON_BASE =
  'flex h-12 w-full items-center justify-center rounded-[100px] text-[16px] leading-[22px] ' +
  'font-semibold tracking-[-0.4px] transition-opacity md:h-[54px] md:text-[18px] md:leading-[26px] ' +
  'md:tracking-[-0.45px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

/** 활성 #2a2a2a / 비활성 #a5adb8(시안 27:5222). 비활성은 투명도가 아니라 색이 바뀐다. */
export const ONBOARDING_SUBMIT_CLASS = `${BUTTON_BASE} bg-[#2a2a2a] text-white hover:opacity-90 disabled:cursor-not-allowed disabled:bg-[#a5adb8] disabled:hover:opacity-100`

export const ONBOARDING_PRIMARY_BUTTON_CLASS = `${BUTTON_BASE} bg-[#2a2a2a] text-white hover:opacity-90`

export const ONBOARDING_SECONDARY_BUTTON_CLASS = `${BUTTON_BASE} border border-[#cdd3db] bg-white text-[#2a2a2a] hover:opacity-90`
