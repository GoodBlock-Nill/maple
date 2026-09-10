'use server'

import { redirect } from 'next/navigation'

import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { AUTH_MESSAGE, toAuthErrorMessage } from '@/lib/auth/auth-error-messages'
import { resolvePostAuthPath } from '@/lib/auth/post-auth'
import { createClient } from '@/lib/supabase/server'
import { absoluteUrl } from '@/lib/utils/absolute-url'
import { sanitizeNextPath } from '@/lib/validation/auth'
import {
  forgotPasswordSchema,
  loginSchema,
  newPasswordSchema,
  RESET_PASSWORD_PATH,
} from '@/lib/validation/email-auth'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 이메일 인증 서버 액션 — 로그인 · 비밀번호 찾기 · 비밀번호 재설정.
 *
 * 회원가입(인증번호 전송·확인·비밀번호 설정)은 `signup-actions.ts` 에 있다.
 *
 * 공통 원칙 두 가지.
 *  1) 원문 오류는 절대 노출하지 않는다 — `toAuthErrorMessage()` 로 옮겨 적는다.
 *  2) 계정 존재 여부를 흘리지 않는다 — 비밀번호 찾기는 성공/실패를 구분하지 않고
 *     같은 안내를 돌려준다(계정 열거 방지).
 */

const LOGIN_PATH = '/login'

/** 재설정 메일의 링크가 도착하는 곳. 세션을 심은 뒤 `/reset-password` 로 넘긴다. */
const RECOVERY_REDIRECT_PATH = `/auth/confirm?type=recovery&next=${encodeURIComponent(RESET_PASSWORD_PATH)}`

const RESET_SENT_MESSAGE =
  '입력하신 주소로 가입된 계정이 있다면 비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해 주세요.'

/**
 * 이메일·비밀번호 로그인.
 *
 * 성공하면 `resolvePostAuthDestination()` 이 정한 곳으로 보낸다 — 탈퇴 대기
 * 계정은 복구 화면, 온보딩 미완료는 온보딩이 먼저다.
 */
export async function signInWithPassword(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: readField(formData, 'email'),
    password: readField(formData, 'password'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error !== null || data.user === null) {
    return { formError: toAuthErrorMessage(error, AUTH_MESSAGE.invalidCredentials) }
  }

  const destination = await resolvePostAuthPath(
    supabase,
    data.user.id,
    sanitizeNextPath(readField(formData, 'next')),
  )

  // redirect() 는 예외를 던진다. try/catch 바깥에서 호출해야 한다(Next 16 문서).
  redirect(destination)
}

/**
 * 비밀번호 재설정 메일 요청.
 *
 * 가입되지 않은 주소여도 같은 안내를 돌려준다. "가입되지 않은 이메일입니다" 는
 * 공격자에게 회원 목록을 확인시켜 주는 응답이다.
 */
export async function requestPasswordReset(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: readField(formData, 'email') })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: absoluteUrl(RECOVERY_REDIRECT_PATH),
  })

  /* 발송 빈도 제한(429)만 따로 알린다 — 이건 계정 존재 여부와 무관한 정보이고,
     그대로 성공이라고 답하면 사용자가 오지 않는 메일을 계속 기다린다. */
  if (error !== null && error.status === 429) {
    return { formError: AUTH_MESSAGE.rateLimited }
  }

  return { message: RESET_SENT_MESSAGE }
}

/**
 * 새 비밀번호 저장(재설정 화면).
 *
 * 메일 링크가 만든 세션이 있어야 한다. 저장 뒤에는 **반드시 로그아웃**한다 —
 * 메일 링크로 열린 세션을 그대로 두면, 링크가 남아 있는 기기에서 그대로 로그인
 * 상태가 유지된다. 새 비밀번호로 다시 들어오게 하는 편이 안전하다.
 */
export async function updatePassword(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({
    password: readField(formData, 'password'),
    passwordConfirm: readField(formData, 'passwordConfirm'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    return { formError: '재설정 링크가 만료되었습니다. 비밀번호 찾기를 다시 요청해 주세요.' }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error !== null) {
    return { formError: toAuthErrorMessage(error) }
  }

  await supabase.auth.signOut()

  redirect(`${LOGIN_PATH}?notice=password_updated`)
}
