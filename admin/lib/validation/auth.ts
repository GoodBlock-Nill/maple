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
/* 화면 문구                                                                   */
/* -------------------------------------------------------------------------- */

/**
 * 관리자가 아닌 계정으로 들어왔을 때의 안내.
 *
 * 로그인 액션(`signInAction`)·콜백 라우트·`loginErrorMessage('not_admin')` 이
 * 모두 이 문장을 쓴다. 관리자 계정은 **초대로만** 만들어지므로(2026-09-09 제품
 * 결정) 안내도 초대 요청으로 돌린다.
 */
export const NOT_ADMIN_MESSAGE =
  '관리자 권한이 없는 계정입니다. 슈퍼어드민에게 관리자 초대를 요청해 주세요.'

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
