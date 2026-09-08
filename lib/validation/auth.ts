import { z } from 'zod'

/**
 * 인증 폼 검증 스키마.
 *
 * 클라이언트 검증은 편의일 뿐이고, 서버 액션이 같은 스키마로 다시 파싱한다.
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출되므로(Next 16 문서
 * "Server Functions are reachable via direct POST requests") 신뢰 경계는 서버다.
 */

export const PASSWORD_MIN_LENGTH = 8
export const NICKNAME_MIN_LENGTH = 2
export const NICKNAME_MAX_LENGTH = 12

/** 로그인 후 돌아갈 기본 경로. */
export const DEFAULT_NEXT_PATH = '/'

/* `.trim()` 을 먼저 적용한 뒤 형식을 검사해야 붙여넣기로 앞뒤 공백이 섞인 값도
   통과한다. 순서를 바꾸면 공백 때문에 형식 검사에서 먼저 걸린다. */
const email = z
  .string()
  .trim()
  .max(254, { message: '이메일 주소가 너무 깁니다.' })
  .pipe(z.email({ message: '올바른 이메일 주소를 입력해 주세요.' }))

const password = z
  .string()
  .min(PASSWORD_MIN_LENGTH, { message: `비밀번호는 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.` })
  /* Supabase Auth 는 bcrypt 를 쓰고 bcrypt 는 72바이트를 넘는 입력을 잘라 낸다.
     길이를 막지 않으면 "긴 비밀번호가 사실은 같은 비밀번호"인 상황이 생긴다. */
  .max(72, { message: '비밀번호는 72자 이하로 입력해 주세요.' })

const nickname = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH, { message: `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다.` })
  .max(NICKNAME_MAX_LENGTH, { message: `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.` })
  .regex(/^[가-힣a-zA-Z0-9_]+$/u, {
    message: '닉네임은 한글·영문·숫자·밑줄만 사용할 수 있습니다.',
  })

export const loginSchema = z.object({
  email,
  password: z.string().min(1, { message: '비밀번호를 입력해 주세요.' }),
})

export const registerSchema = z.object({
  email,
  password,
  nickname,
})

export const forgotPasswordSchema = z.object({ email })

export type LoginInput = z.infer<typeof loginSchema>
export type RegisterInput = z.infer<typeof registerSchema>
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>

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
  if (/[\u0000-\u001f\u007f]/u.test(value)) {
    return DEFAULT_NEXT_PATH
  }

  return value
}
