/**
 * Supabase Auth 오류 → 화면 문구.
 *
 * 원문 오류는 절대 그대로 노출하지 않는다. 영어 문장이라 읽히지 않을 뿐 아니라
 * 계정 존재 여부·내부 설정 같은 정보가 섞여 나온다. 알 수 없는 코드는 호출부가
 * 정한 기본 문구로 눌러 담는다.
 *
 * 판정 순서는 `code` → `status` → `message` 다. supabase-js v2 의 `AuthError`
 * 는 안정된 `code` 를 주지만, 게이트웨이가 만든 429 처럼 코드가 없는 응답도 있다.
 */

/** 액션이 받는 오류의 최소 모양. supabase-js 의 `AuthError` 가 그대로 들어맞는다. */
export type AuthErrorLike = {
  code?: string | null
  status?: number | null
  message?: string | null
}

export const AUTH_MESSAGE = {
  invalidCredentials: '이메일 또는 비밀번호가 올바르지 않습니다.',
  emailNotConfirmed: '이메일 인증이 완료되지 않은 계정입니다.',
  rateLimited: '인증번호 요청이 너무 잦습니다. 잠시 후 다시 시도해 주세요.',
  otpInvalid: '인증번호가 올바르지 않거나 만료되었습니다.',
  samePassword: '이전과 다른 비밀번호를 입력해 주세요.',
  weakPassword: '너무 쉬운 비밀번호입니다. 다른 비밀번호를 입력해 주세요.',
  emailTaken: '이미 가입된 이메일입니다. 로그인해 주세요.',
  emailUnusable: '사용할 수 없는 이메일 주소입니다. 다른 주소를 입력해 주세요.',
  signupDisabled: '지금은 새로 가입할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  sessionRequired: '인증 정보가 만료되었습니다. 처음부터 다시 진행해 주세요.',
  generic: '요청을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.',
} as const

/** `code` 로 곧바로 갈라지는 것들. Supabase 문서의 Auth error code 목록을 따른다. */
const BY_CODE: Record<string, string | undefined> = {
  invalid_credentials: AUTH_MESSAGE.invalidCredentials,
  email_not_confirmed: AUTH_MESSAGE.emailNotConfirmed,
  over_email_send_rate_limit: AUTH_MESSAGE.rateLimited,
  over_request_rate_limit: AUTH_MESSAGE.rateLimited,
  over_sms_send_rate_limit: AUTH_MESSAGE.rateLimited,
  otp_expired: AUTH_MESSAGE.otpInvalid,
  otp_disabled: AUTH_MESSAGE.otpInvalid,
  same_password: AUTH_MESSAGE.samePassword,
  weak_password: AUTH_MESSAGE.weakPassword,
  email_exists: AUTH_MESSAGE.emailTaken,
  /* Supabase 가 막는 주소(예약 도메인 `.local` · `example.com` 등). */
  email_address_invalid: AUTH_MESSAGE.emailUnusable,
  email_address_not_authorized: AUTH_MESSAGE.emailUnusable,
  user_already_exists: AUTH_MESSAGE.emailTaken,
  signup_disabled: AUTH_MESSAGE.signupDisabled,
  email_provider_disabled: AUTH_MESSAGE.signupDisabled,
  session_not_found: AUTH_MESSAGE.sessionRequired,
  session_expired: AUTH_MESSAGE.sessionRequired,
}

/** 코드가 없을 때만 보는 원문 조각. 소문자로 눌러 비교한다. */
const BY_MESSAGE: readonly [string, string][] = [
  ['token has expired or is invalid', AUTH_MESSAGE.otpInvalid],
  ['invalid login credentials', AUTH_MESSAGE.invalidCredentials],
  ['email not confirmed', AUTH_MESSAGE.emailNotConfirmed],
  ['user already registered', AUTH_MESSAGE.emailTaken],
  ['for security purposes', AUTH_MESSAGE.rateLimited],
  ['rate limit', AUTH_MESSAGE.rateLimited],
  ['new password should be different', AUTH_MESSAGE.samePassword],
]

export function toAuthErrorMessage(
  error: AuthErrorLike | null | undefined,
  fallback: string = AUTH_MESSAGE.generic,
): string {
  if (error === null || error === undefined) {
    return fallback
  }

  const byCode = typeof error.code === 'string' ? BY_CODE[error.code] : undefined

  if (byCode !== undefined) {
    return byCode
  }

  // 게이트웨이가 만든 429 는 코드가 없다. 상태 코드만으로도 뜻이 분명하다.
  if (error.status === 429) {
    return AUTH_MESSAGE.rateLimited
  }

  const message = typeof error.message === 'string' ? error.message.toLowerCase() : ''
  const byMessage = BY_MESSAGE.find(([needle]) => message.includes(needle))

  return byMessage?.[1] ?? fallback
}
