import { z } from 'zod'

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
/* 온보딩                                                                      */
/* -------------------------------------------------------------------------- */

const nickname = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH, { message: `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다.` })
  .max(NICKNAME_MAX_LENGTH, { message: `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.` })
  .regex(/^[가-힣a-zA-Z0-9_]+$/u, {
    message: '닉네임은 한글·영문·숫자·밑줄만 사용할 수 있습니다.',
  })

/* 체크박스는 체크했을 때만 FormData 에 담긴다. 액션이 boolean 으로 바꿔 넘기고
   여기서는 "반드시 true" 만 확인한다. `z.literal(true)` 로 두면 미체크(false)일 때
   메시지를 필드별로 다르게 줄 수 없어 refine 대신 literal + 개별 message 를 쓴다. */
export const onboardingSchema = z.object({
  nickname,
  termsAgreed: z.literal(true, { message: '이용약관에 동의해 주세요.' }),
  privacyAgreed: z.literal(true, { message: '개인정보처리방침에 동의해 주세요.' }),
  ageConfirmed: z.literal(true, { message: '만 14세 이상만 가입할 수 있습니다.' }),
})

export type OnboardingInput = z.infer<typeof onboardingSchema>

/** 온보딩 완료 여부 판단에 필요한 최소 프로필 모양. */
export type OnboardingStatusSource = {
  nickname?: string | null
  terms_agreed_at?: string | null
  privacy_agreed_at?: string | null
  age_confirmed_at?: string | null
}

/**
 * 온보딩을 마친 프로필인지 판정한다.
 *
 * 동의 시각 세 개가 모두 남아 있어야 "글쓰기·댓글·문의"를 열어 준다.
 * 프로필 자체가 없으면(트리거 실패 등) 당연히 미완료다.
 */
export function isOnboardingComplete(profile: OnboardingStatusSource | null | undefined): boolean {
  if (profile === null || profile === undefined) {
    return false
  }

  const filled = (value: string | null | undefined): boolean =>
    typeof value === 'string' && value.trim() !== ''

  return (
    filled(profile.nickname) &&
    filled(profile.terms_agreed_at) &&
    filled(profile.privacy_agreed_at) &&
    filled(profile.age_confirmed_at)
  )
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

/**
 * 온보딩이 끝난 뒤 돌아갈 곳.
 *
 * 온보딩 자체를 `next` 로 지정하면 무한 루프가 되므로 기본 경로로 되돌린다.
 */
export function sanitizePostAuthPath(value: unknown): string {
  const path = sanitizeNextPath(value)

  return path === ONBOARDING_PATH || path.startsWith(`${ONBOARDING_PATH}?`)
    ? DEFAULT_NEXT_PATH
    : path
}
