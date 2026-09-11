import { z } from 'zod'

import { FEATURES } from '@/lib/constants/features'

/**
 * 인증 검증 스키마.
 *
 * 이 사이트의 로그인 수단은 **간편로그인(구글·카카오·네이버)뿐**이다.
 * 이메일·비밀번호 가입은 제거되었으므로 관련 스키마도 남기지 않는다.
 *
 * 클라이언트 검증은 편의일 뿐이고, 서버 액션이 같은 스키마로 다시 파싱한다.
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출되므로(Next 16 문서
 * "Server Functions are reachable via direct POST requests") 신뢰 경계는 서버다.
 */

export const NICKNAME_MIN_LENGTH = 2
export const NICKNAME_MAX_LENGTH = 12

/** 로그인 후 돌아갈 기본 경로. */
export const DEFAULT_NEXT_PATH = '/'

/** 온보딩(최초 로그인 시 닉네임·약관 동의) 경로. */
export const ONBOARDING_PATH = '/auth/onboarding'

/** 탈퇴 대기 중인 계정이 다시 로그인했을 때 복구를 묻는 경로. */
export const RESTORE_PATH = '/auth/restore'

/* -------------------------------------------------------------------------- */
/* 간편로그인 제공자                                                           */
/* -------------------------------------------------------------------------- */

export const SOCIAL_PROVIDERS = ['google', 'kakao', 'naver'] as const

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

/** 화면 문구·기본 닉네임 시드에 쓰는 한글 표기. */
export const SOCIAL_PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: '구글',
  kakao: '카카오',
  naver: '네이버',
}

export function isSocialProvider(value: unknown): value is SocialProvider {
  return SOCIAL_PROVIDERS.some((provider) => provider === value)
}

/**
 * 스텁 계정의 기본 닉네임.
 *
 * "구글 테스터"처럼 공백을 넣으면 아래 닉네임 규칙(공백 불가)에 걸려 온보딩
 * 폼에서 곧바로 반려된다. 사용자가 그대로 확정할 수 있도록 공백을 빼고 만든다.
 */
export function stubNicknameFor(provider: SocialProvider): string {
  return `${SOCIAL_PROVIDER_LABEL[provider]}테스터`
}

/* -------------------------------------------------------------------------- */
/* 로그인 방식 스위치                                                          */
/* -------------------------------------------------------------------------- */

export const SOCIAL_LOGIN_MODES = ['stub', 'oauth'] as const

export type SocialLoginMode = (typeof SOCIAL_LOGIN_MODES)[number]

/**
 * `SOCIAL_LOGIN_MODE` 해석. 값이 없거나 알 수 없으면 `stub` 이다.
 *
 * TODO(auth): 개발팀이 실 OAuth 를 붙이면 배포 환경에서 `oauth` 로 바꾼다.
 * UI 는 그대로 두고 이 값만 바꾸면 동작이 전환된다.
 */
export function parseSocialLoginMode(value: string | undefined): SocialLoginMode {
  const normalized = value?.trim().toLowerCase()

  return SOCIAL_LOGIN_MODES.find((mode) => mode === normalized) ?? 'stub'
}

/* -------------------------------------------------------------------------- */
/* 메이플스토리 월드 계정 연동                                                 */
/* -------------------------------------------------------------------------- */

/** 클라이언트 "설정 - 계정" 화면에 보이는 숫자 UID. */
export const MSW_UID_PATTERN = /^[0-9]{10,20}$/

/** 클라이언트 "더보기 - 프로필 편집" 화면에 보이는 "#" 코드. */
export const MSW_PROFILE_CODE_PATTERN = /^#[a-z0-9]{4,10}$/

export const mswUidSchema = z.string().trim().regex(MSW_UID_PATTERN, {
  message: 'UID는 숫자 10~20자로 입력해 주세요. (예: 20123000000000000)',
})

/**
 * "#" 없이 붙여넣거나 대문자가 섞여도 통과하도록 검증 전에 다듬는다
 * (트림 → 소문자 → 앞에 "#" 이 없으면 붙이기). DB 제약(CHECK)은 이미 정규화된
 * 값만 받는다고 가정하므로, 저장 전에는 반드시 이 스키마를 거쳐야 한다.
 */
export const mswProfileCodeSchema = z
  .string()
  .trim()
  .transform((value) => {
    const lower = value.toLowerCase()
    return lower.startsWith('#') ? lower : `#${lower}`
  })
  .refine((value) => MSW_PROFILE_CODE_PATTERN.test(value), {
    message: '프로필 코드는 "#" 뒤에 영문 소문자·숫자 4~10자로 입력해 주세요. (예: #abcd1)',
  })

/**
 * 온보딩/내 정보 폼에 실제로 꽂는 UID·프로필 코드 필드.
 *
 * `FEATURES.mswAccountFields` 가 꺼져 있으면 화면에 입력칸 자체가 없으므로
 * FormData 에도 값이 안 실린다 — 그 상태에서 `mswUidSchema`(필수) 를 그대로
 * 쓰면 매번 검증에서 튕긴다. 값이 있든 없든 그냥 통과시키고 서버 액션이
 * 컬럼에 쓰지 않도록 한다(기존 값 보존).
 */
const mswUidField = FEATURES.mswAccountFields ? mswUidSchema : z.string().trim().optional()
const mswProfileCodeField = FEATURES.mswAccountFields
  ? mswProfileCodeSchema
  : z.string().trim().optional()

/* -------------------------------------------------------------------------- */
/* 온보딩                                                                      */
/* -------------------------------------------------------------------------- */

/* 온보딩과 "내 정보" 닉네임 변경이 같은 규칙을 쓴다. 두 곳에서 재사용하도록
   내보낸다(민감한 이름은 아니라 export 해도 되지만, 이 파일 밖에서 규칙을 다시
   베끼는 쪽이 더 위험하다). */
/** 허용 문자 집합. 화면의 즉시 검증(`nicknameIssue`)과 스키마가 같은 정규식을 쓴다. */
export const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9_]+$/u

export const nicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH, { message: `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다.` })
  .max(NICKNAME_MAX_LENGTH, { message: `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.` })
  .regex(NICKNAME_PATTERN, {
    message: '닉네임은 한글·영문·숫자·밑줄만 사용할 수 있습니다.',
  })

/** 닉네임이 규칙을 어긴 지점. 통과하면 null. */
export type NicknameIssue = 'empty' | 'charset' | 'length'

/**
 * 회원가입 폼이 **입력할 때마다** 부르는 동기 검증.
 *
 * 버튼 활성 조건("닉네임 미입력 또는 검증 실패", 시안 27:5222)을 화면에서 바로
 * 판정해야 하는데, zod 스키마는 오류 메시지를 만들려고 이슈 배열을 돌린다. 여기서는
 * "어디가 틀렸는지"만 알면 되므로 같은 규칙을 가벼운 함수로 한 번 더 노출한다.
 * 최종 판단은 서버 액션이 `onboardingSchema` 로 다시 한다.
 */
export function nicknameIssue(value: string): NicknameIssue | null {
  const trimmed = value.trim()

  if (trimmed === '') {
    return 'empty'
  }

  if (!NICKNAME_PATTERN.test(trimmed)) {
    return 'charset'
  }

  if (trimmed.length < NICKNAME_MIN_LENGTH || trimmed.length > NICKNAME_MAX_LENGTH) {
    return 'length'
  }

  return null
}

/* 체크박스는 체크했을 때만 FormData 에 담긴다. 액션이 boolean 으로 바꿔 넘기고
   여기서는 "반드시 true" 만 확인한다. `z.literal(true)` 로 두면 미체크(false)일 때
   메시지를 필드별로 다르게 줄 수 없어 refine 대신 literal + 개별 message 를 쓴다.
   메이플스토리 월드 UID·프로필 코드도 이때 함께 받는다 — 랭킹 등 연동 화면이
   나중에 이 값을 참조하므로 첫 로그인에서 한 번에 받아 두는 편이 낫다. */
export const onboardingSchema = z.object({
  nickname: nicknameSchema,
  mswUid: mswUidField,
  mswProfileCode: mswProfileCodeField,
  termsAgreed: z.literal(true, { message: '이용약관에 동의해 주세요.' }),
  privacyAgreed: z.literal(true, { message: '개인정보처리방침에 동의해 주세요.' }),
  ageConfirmed: z.literal(true, { message: '만 14세 이상만 가입할 수 있습니다.' }),
  /* [선택] 마케팅 정보 수신 동의. 체크하지 않아도 가입이 되어야 하므로 boolean 이다.
     값은 `profiles.marketing_*_opt_out` 두 컬럼으로 뒤집혀 저장된다(동의=수신거부 false). */
  marketingAgreed: z.boolean(),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>

/* -------------------------------------------------------------------------- */
/* 내 정보 — 닉네임 · 메이플스토리 월드 계정 변경                              */
/* -------------------------------------------------------------------------- */

/** "내 정보" 화면의 경로. 로그인·온보딩 리다이렉트의 `next` 값으로도 쓴다. */
export const ACCOUNT_PATH = '/account'

/** 마이페이지 "닉네임 변경" 폼. 규칙은 온보딩과 같은 `nicknameSchema` 하나다. */
export const updateNicknameSchema = z.object({ nickname: nicknameSchema })

/**
 * "계정 연동" 화면의 입력.
 *
 * `updateAccountSchema` 와 달리 **플래그와 무관하게 두 값을 모두 요구**한다 —
 * 이 화면은 월드 계정을 연결하는 것이 목적이라 빈 값으로 저장할 이유가 없고,
 * 플래그가 꺼져 있으면 서버 액션이 시작 전에 거절한다(입력칸도 비활성이다).
 */
export const linkMswAccountSchema = z.object({
  mswUid: mswUidSchema,
  mswProfileCode: mswProfileCodeSchema,
})

export type LinkMswAccountInput = z.infer<typeof linkMswAccountSchema>

export const updateAccountSchema = z.object({
  nickname: nicknameSchema,
  mswUid: mswUidField,
  mswProfileCode: mswProfileCodeField,
})

export type UpdateAccountInput = z.infer<typeof updateAccountSchema>

/** 온보딩 완료 여부 판단에 필요한 최소 프로필 모양. */
export type OnboardingStatusSource = {
  nickname?: string | null
  terms_agreed_at?: string | null
  privacy_agreed_at?: string | null
  age_confirmed_at?: string | null
  msw_uid?: string | null
  msw_profile_code?: string | null
}

/**
 * 온보딩을 마친 프로필인지 판정한다.
 *
 * 동의 시각 세 개가 모두 남아 있어야 "글쓰기·댓글·문의"를 열어 준다. 프로필
 * 자체가 없으면(트리거 실패 등) 당연히 미완료다.
 *
 * `FEATURES.mswAccountFields` 가 켜져 있을 때만 메이플스토리 월드 UID·프로필
 * 코드까지 함께 요구한다 — 꺼져 있으면 입력칸 자체가 없어 채울 방법이 없으므로
 * 이 조건을 걸면 아무도 온보딩을 통과하지 못한다.
 */
export function isOnboardingComplete(profile: OnboardingStatusSource | null | undefined): boolean {
  if (profile === null || profile === undefined) {
    return false
  }

  const filled = (value: string | null | undefined): boolean =>
    typeof value === 'string' && value.trim() !== ''

  const hasBasics =
    filled(profile.nickname) &&
    filled(profile.terms_agreed_at) &&
    filled(profile.privacy_agreed_at) &&
    filled(profile.age_confirmed_at)

  if (!FEATURES.mswAccountFields) {
    return hasBasics
  }

  return hasBasics && filled(profile.msw_uid) && filled(profile.msw_profile_code)
}

/* -------------------------------------------------------------------------- */
/* 리다이렉트 경로 정규화                                                      */
/* -------------------------------------------------------------------------- */

/** 제어문자(C0·C1·DEL). 유니코드 카테고리 Cc 로 한 번에 잡는다. */
const CONTROL_CHARACTER = /\p{Cc}/u

/**
 * `?next=` 값을 **같은 오리진의 경로**로만 좁힌다.
 *
 * 검사를 빼먹으면 `/login?next=https://evil.example` 링크 하나로 오픈 리다이렉트가
 * 된다. 프로토콜 상대 URL(`//evil.example`)과 백슬래시 변종(`/\evil.example`)은
 * 브라우저가 호스트로 해석하므로 함께 막는다.
 */
export function sanitizeNextPath(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) {
    return DEFAULT_NEXT_PATH
  }

  if (!value.startsWith('/')) {
    return DEFAULT_NEXT_PATH
  }

  const second = value.charAt(1)

  if (second === '/' || second === '\\') {
    return DEFAULT_NEXT_PATH
  }

  // 제어문자가 섞이면 브라우저마다 파싱이 달라진다. 통째로 거절한다.
  if (CONTROL_CHARACTER.test(value)) {
    return DEFAULT_NEXT_PATH
  }

  return value
}

/** 로그인 뒤 거치는 중간 화면. 이 경로들을 `next` 로 두면 자기 자신으로 되돌아가는 루프가 된다. */
const INTERSTITIAL_PATHS = [ONBOARDING_PATH, RESTORE_PATH] as const

/**
 * 온보딩·복구가 끝난 뒤 돌아갈 곳.
 *
 * 온보딩(또는 복구) 화면 자체를 `next` 로 지정하면 무한 루프가 되므로 기본 경로로
 * 되돌린다.
 */
export function sanitizePostAuthPath(value: unknown): string {
  const path = sanitizeNextPath(value)

  return INTERSTITIAL_PATHS.some(
    (interstitial) => path === interstitial || path.startsWith(`${interstitial}?`),
  )
    ? DEFAULT_NEXT_PATH
    : path
}
