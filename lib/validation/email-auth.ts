import { z } from 'zod'

/**
 * 이메일 로그인·회원가입 검증 스키마.
 *
 * `lib/validation/auth.ts` 는 간편로그인·온보딩·경로 정규화를 이미 담고 있어
 * 300줄 한도에 걸린다. 이메일 인증(로그인 · 인증번호 · 비밀번호)에만 쓰이는
 * 규칙은 이 파일이 소유한다.
 *
 * 클라이언트 검증은 편의일 뿐이다. 서버 액션은 UI 를 거치지 않는 직접 POST 로도
 * 호출되므로(Next 16 문서) 같은 스키마로 서버에서 다시 파싱한다.
 */

/** RFC 5321 의 주소 상한. 그보다 긴 값은 Auth 서버에 보내기 전에 끊는다. */
export const EMAIL_MAX_LENGTH = 254

/** 비밀번호 재설정 화면. 메일 링크가 만든 세션이 있어야 열린다(프록시 보호 경로). */
export const RESET_PASSWORD_PATH = '/reset-password'

/** 비밀번호 찾기(재설정 메일 요청) 화면. */
export const FORGOT_PASSWORD_PATH = '/forgot-password'

/** 메일로 받는 인증번호 자릿수. `supabase/config.toml` 의 `otp_length` 와 같아야 한다. */
export const OTP_LENGTH = 6

/** Supabase 기본 최소 길이(6)보다 강하게 잡는다. */
export const PASSWORD_MIN_LENGTH = 8

/** bcrypt 는 73바이트째부터 버린다. 뒤가 조용히 무시되지 않도록 여기서 끊는다. */
export const PASSWORD_MAX_LENGTH = 72

/** 시안에는 비밀번호 규칙 안내가 없다. 규칙을 어겼을 때만 오류 자리에 보여 준다. */
export const PASSWORD_RULE_MESSAGE = `비밀번호는 영문과 숫자를 포함해 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`

export const PASSWORD_MISMATCH_MESSAGE = '비밀번호가 일치하지 않습니다.'

export const OTP_LENGTH_MESSAGE = `인증번호 ${OTP_LENGTH}자리를 입력해 주세요.`

/* zod 4 는 `z.string().email()` 을 폐기하고 최상위 `z.email()` 로 옮겼다.
   공백을 먼저 다듬어야 "  a@b.co " 같은 붙여넣기가 반려되지 않으므로 pipe 로 잇는다.
   소문자 정규화는 파싱 뒤에 한다 — `z.email()` 은 대문자 주소도 유효로 보고,
   저장·조회는 항상 소문자 한 가지 표기만 쓰기 위해서다. */
export const emailSchema = z
  .string()
  .trim()
  .min(1, '이메일을 입력해 주세요.')
  .max(EMAIL_MAX_LENGTH, `이메일은 ${EMAIL_MAX_LENGTH}자를 넘을 수 없습니다.`)
  .pipe(z.email('이메일 형식이 올바르지 않습니다.'))
  .transform((value) => value.toLowerCase())

/**
 * 새 비밀번호 규칙 — 길이 + 영문 + 숫자.
 *
 * 세 조건을 각각 다른 문장으로 알리면 사용자가 한 번에 하나씩만 고치게 된다.
 * 어느 조건을 어겼든 규칙 전체를 한 문장으로 보여 준다.
 */
export const passwordSchema = z
  .string()
  .max(PASSWORD_MAX_LENGTH, `비밀번호는 ${PASSWORD_MAX_LENGTH}자를 넘을 수 없습니다.`)
  .refine((value) => isStrongPassword(value), { message: PASSWORD_RULE_MESSAGE })

/** 숫자만 남긴 뒤 길이를 본다 — 붙여넣기에 섞인 공백·하이픈을 사용자가 지우게 하지 않는다. */
export const otpSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/\D/gu, ''))
  .refine((value) => value.length === OTP_LENGTH, { message: OTP_LENGTH_MESSAGE })

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, '비밀번호를 입력해 주세요.'),
})

export const forgotPasswordSchema = z.object({ email: emailSchema })

export const sendSignupCodeSchema = z.object({ email: emailSchema })

export const verifySignupCodeSchema = z.object({ email: emailSchema, token: otpSchema })

export const newPasswordSchema = z
  .object({
    password: passwordSchema,
    passwordConfirm: z.string().min(1, '비밀번호를 한 번 더 입력해 주세요.'),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ['passwordConfirm'],
    message: PASSWORD_MISMATCH_MESSAGE,
  })

export type LoginInput = z.infer<typeof loginSchema>
export type NewPasswordInput = z.infer<typeof newPasswordSchema>

/**
 * 비밀번호 규칙 판정(순수 함수).
 *
 * 클라이언트 폼이 "가입하기" 버튼 활성 조건에도 같은 규칙을 써야 해서 스키마와
 * 따로 내보낸다 — 규칙이 두 벌이 되면 버튼은 켜지는데 서버가 반려하는 상태가 된다.
 */
export function isStrongPassword(value: string): boolean {
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    /\p{L}/u.test(value) &&
    /[0-9]/u.test(value)
  )
}

/** 로그인 성공 뒤 `/login?notice=…` 로 전달하는 안내. 알 수 없는 값은 그리지 않는다. */
export const LOGIN_NOTICE_MESSAGE: Record<string, string | undefined> = {
  password_updated: '비밀번호가 변경되었습니다. 다시 로그인해 주세요.',
}
