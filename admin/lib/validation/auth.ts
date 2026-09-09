import { z } from 'zod'

import { EMAIL_MAX_LENGTH } from '@/lib/constants/field-limits'

/**
 * 관리자 인증 폼 스키마.
 *
 * 서버 액션이 클라이언트 검증을 신뢰하지 않고 다시 파싱한다. 폼은 이 스키마의
 * 오류 메시지를 그대로 필드 밑에 그린다.
 */

/** Supabase Auth 의 기본 최소 길이(6)보다 강하게 잡는다 — 관리자 계정이다. */
export const ADMIN_PASSWORD_MIN_LENGTH = 10

/** bcrypt 가 73바이트째부터 버린다. 그보다 긴 비밀번호는 뒤가 무시되므로 여기서 끊는다. */
export const ADMIN_PASSWORD_MAX_LENGTH = 72

/* zod 4 는 `z.string().email()` 을 폐기하고 최상위 `z.email()` 로 옮겼다.
   공백을 먼저 다듬어야 "  a@b.co " 같은 붙여넣기가 반려되지 않으므로 pipe 로 잇는다. */
const emailSchema = z
  .string()
  .trim()
  .min(1, '이메일을 입력해 주세요.')
  .max(EMAIL_MAX_LENGTH, `이메일은 ${EMAIL_MAX_LENGTH}자를 넘을 수 없습니다.`)
  .pipe(z.email('이메일 형식이 올바르지 않습니다.'))

const passwordSchema = z
  .string()
  .min(ADMIN_PASSWORD_MIN_LENGTH, `비밀번호는 ${ADMIN_PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`)
  .max(ADMIN_PASSWORD_MAX_LENGTH, `비밀번호는 ${ADMIN_PASSWORD_MAX_LENGTH}자를 넘을 수 없습니다.`)

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
})

export const forgotPasswordSchema = z.object({
  email: emailSchema,
})

export const setPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요.'),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ['passwordConfirm'],
    message: '비밀번호가 일치하지 않습니다.',
  })

export type LoginInput = z.infer<typeof loginSchema>
export type SetPasswordInput = z.infer<typeof setPasswordSchema>

/**
 * 로그인 후 돌아갈 경로를 정규화한다.
 *
 * 검증 없이 리다이렉트하면 `?next=https://evil.example` 로 오픈 리다이렉트가 된다.
 * 사이트 내부 절대 경로(`/…`)만 허용하고, `//host` 형태(프로토콜 상대 URL)는 거른다.
 */
export function sanitizeNextPath(value: string | null | undefined, fallback = '/'): string {
  if (typeof value !== 'string' || value === '') {
    return fallback
  }

  if (!value.startsWith('/') || value.startsWith('//')) {
    return fallback
  }

  // 백슬래시는 일부 브라우저가 `/` 로 정규화해 `/\evil.example` 이 외부로 나간다.
  if (value.includes('\\')) {
    return fallback
  }

  return value
}

/* -------------------------------------------------------------------------- */
/* 간편로그인 — 제공자 · 동작 모드                                             */
/* -------------------------------------------------------------------------- */

/**
 * 관리자 계정은 더 이상 이메일 초대로 만들지 않는다(2026-09-09 제품 결정).
 * 사용자 사이트에 간편로그인으로 가입한 회원을 회원 상세에서 승격시키므로,
 * 관리자 로그인도 사용자 사이트와 **같은 세 제공자**를 쓴다.
 *
 * 사용자 사이트(`lib/validation/auth.ts`)의 값을 의도적으로 복제한다 — 관리자는
 * 별도 배포라 사용자 앱 모듈을 import 할 수 없다. 값이 갈리면 같은 계정으로
 * 두 사이트에 로그인할 수 없게 되므로, 한쪽을 고치면 다른 쪽도 함께 고친다.
 */
export const SOCIAL_PROVIDERS = ['google', 'kakao', 'naver'] as const

export type SocialProvider = (typeof SOCIAL_PROVIDERS)[number]

/** 화면 문구에 쓰는 한글 표기. */
export const SOCIAL_PROVIDER_LABEL: Record<SocialProvider, string> = {
  google: '구글',
  kakao: '카카오',
  naver: '네이버',
}

export function isSocialProvider(value: unknown): value is SocialProvider {
  return SOCIAL_PROVIDERS.some((provider) => provider === value)
}

/**
 * Supabase 가 **기본 제공자**로 지원하는 목록(`Provider` 유니온)에 들어 있는 값.
 * 네이버는 없어서 커스텀 OAuth 연동이 따로 필요하다 — 그래서 버튼은 그리되
 * 누르면 안내만 돌려준다(가짜로 붙이면 실 연동 때 흔적을 찾기 어렵다).
 */
export const SUPABASE_NATIVE_SOCIAL_PROVIDERS = ['google', 'kakao'] as const

export type NativeSocialProvider = (typeof SUPABASE_NATIVE_SOCIAL_PROVIDERS)[number]

export function isNativeSocialProvider(value: SocialProvider): value is NativeSocialProvider {
  return SUPABASE_NATIVE_SOCIAL_PROVIDERS.some((provider) => provider === value)
}

export const SOCIAL_LOGIN_MODES = ['stub', 'oauth'] as const

export type SocialLoginMode = (typeof SOCIAL_LOGIN_MODES)[number]

/**
 * `SOCIAL_LOGIN_MODE` 해석. 값이 없거나 알 수 없으면 `stub` 이다(사용자 사이트와 동일).
 *
 * 관리자 앱에는 스텁 로그인이 없다. `stub` 은 "아직 실 OAuth 가 없으니 간편로그인
 * 버튼은 안내만 돌려준다"는 뜻이고, 관리자는 그동안 이메일 로그인을 쓴다.
 *
 * TODO(auth): 개발팀이 실 OAuth 를 붙이면 배포 환경에서 `oauth` 로 바꾼다.
 */
export function parseSocialLoginMode(value: string | undefined): SocialLoginMode {
  const normalized = value?.trim().toLowerCase()

  return SOCIAL_LOGIN_MODES.find((mode) => mode === normalized) ?? 'stub'
}

/**
 * 이메일·비밀번호 로그인 섹션을 그릴지. `ADMIN_PASSWORD_LOGIN=disabled` 일 때만 숨긴다.
 *
 * 기본값이 "켬"인 이유: 실 OAuth 가 붙기 전까지 부트스트랩 관리자가 들어올 문이
 * 이것뿐이다. OAuth 전환이 끝나면 배포 환경에서 `disabled` 로 닫는다.
 */
export function isPasswordLoginEnabled(value: string | undefined): boolean {
  return value?.trim().toLowerCase() !== 'disabled'
}

/* -------------------------------------------------------------------------- */
/* 화면 문구                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 관리자가 아닌 계정으로 들어왔을 때의 안내.
 *
 * 로그인 액션(`signInAction`)·OAuth 콜백·`loginErrorMessage('not_admin')` 이
 * 모두 이 문장을 쓴다. 초대 흐름이 사라졌으므로 "초대를 요청" 이 아니라
 * "회원 상세에서 권한 부여" 로 안내한다.
 */
export const NOT_ADMIN_MESSAGE =
  '관리자 권한이 없는 계정입니다. 관리자에게 회원 상세에서 권한 부여를 요청해 주세요.'

/** 실 OAuth 가 아직 없을 때(모드 `stub`) 간편로그인 버튼의 안내. */
export const SOCIAL_LOGIN_STUB_MESSAGE =
  '간편로그인은 실 OAuth 연동 후 사용할 수 있습니다. 아래 운영 계정 로그인을 사용해 주세요.'

/** 네이버는 Supabase 기본 제공자가 아니라 별도 연동이 끝나야 열린다. */
export const SOCIAL_LOGIN_NAVER_MESSAGE = '네이버 로그인은 개발팀 OAuth 연동 후 사용할 수 있습니다.'

/** `/login?error=…` 코드 → 화면 문구. 알 수 없는 코드는 표시하지 않는다. */
export const LOGIN_ERROR_MESSAGES: Record<string, string> = {
  not_admin: NOT_ADMIN_MESSAGE,
  expired: '30분 동안 활동이 없어 자동으로 로그아웃되었습니다. 다시 로그인해 주세요.',
  invalid_link: '유효하지 않은 링크입니다. 메일의 링크를 다시 확인해 주세요.',
  link_expired: '링크가 만료되었습니다. 비밀번호 재설정 메일을 다시 요청해 주세요.',
  auth_failed: '인증에 실패했습니다. 다시 시도해 주세요.',
  session_required: '로그인이 필요합니다.',
}

export function loginErrorMessage(code: string | null | undefined): string | null {
  if (typeof code !== 'string') {
    return null
  }

  return LOGIN_ERROR_MESSAGES[code] ?? null
}
