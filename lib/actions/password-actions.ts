'use server'

import { redirect } from 'next/navigation'

import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { AUTH_MESSAGE, toAuthErrorMessage } from '@/lib/auth/auth-error-messages'
import { createClient } from '@/lib/supabase/server'
import { changePasswordSchema } from '@/lib/validation/account'
import { ACCOUNT_PATH } from '@/lib/validation/auth'

import type { FormState } from '@/lib/actions/form-state'

export type ChangePasswordState = FormState & {
  /**
   * 성공 시각. 화면이 이 값을 `key` 로 써서 입력 세 칸을 새로 마운트한다 —
   * 두 번 연속 성공해도 값이 달라져야 폼이 다시 비워진다.
   */
  changedAt?: number
}

/**
 * 마이페이지 "비밀번호 변경".
 *
 * 재설정 화면(`updatePassword`)과 달리 **현재 비밀번호로 재인증**한 뒤에 바꾼다.
 * 로그인된 세션만으로 비밀번호를 바꿀 수 있으면, 잠깐 자리를 비운 브라우저 하나로
 * 계정이 통째로 넘어간다.
 *
 * 재인증에 `signInWithPassword` 를 쓰면 같은 사용자의 세션 쿠키가 새 토큰으로
 * 교체된다 — 같은 계정이라 로그인 상태는 유지되고, 실패해도 기존 세션은 그대로다
 * (Supabase 는 실패 시 쿠키를 건드리지 않는다).
 *
 * 성공해도 로그아웃하지 않는다. 재설정 화면은 "메일 링크로 열린 세션"이라 끊는
 * 것이 맞지만, 여기서는 본인이 현재 비밀번호를 아는 상태로 조작한 것이다.
 */

const LOGIN_PATH = '/login'

const PASSWORD_CHANGED_MESSAGE = '비밀번호를 변경했습니다.'
const CURRENT_PASSWORD_WRONG_MESSAGE = '현재 비밀번호가 일치하지 않습니다.'
const NO_PASSWORD_MESSAGE = '간편로그인 계정은 비밀번호를 변경할 수 없습니다.'

export async function changePasswordAction(
  _prevState: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(ACCOUNT_PATH)}`)
  }

  const email = user.email ?? ''

  if (email === '') {
    return { formError: NO_PASSWORD_MESSAGE }
  }

  const parsed = changePasswordSchema.safeParse({
    currentPassword: readField(formData, 'currentPassword'),
    password: readField(formData, 'password'),
    passwordConfirm: readField(formData, 'passwordConfirm'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { error: reauthError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.currentPassword,
  })

  if (reauthError !== null) {
    return { fieldErrors: { currentPassword: CURRENT_PASSWORD_WRONG_MESSAGE } }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error !== null) {
    /* Supabase 도 "이전과 같은 비밀번호"를 막는다(same_password). 스키마가 먼저
       걸러 내지만, 대소문자 정규화 같은 서버 규칙이 생기면 여기로 떨어진다. */
    return { fieldErrors: { password: toAuthErrorMessage(error, AUTH_MESSAGE.generic) } }
  }

  return { message: PASSWORD_CHANGED_MESSAGE, changedAt: Date.now() }
}
