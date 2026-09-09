'use server'

import { redirect } from 'next/navigation'

import { actionFailure } from '@/lib/actions/action-failure'
import {
  EMPTY_FORM_STATE,
  readField,
  toFieldErrors,
  type FormState,
} from '@/lib/actions/form-state'
import { adminSiteUrl } from '@/lib/supabase/env'
import { createClient } from '@/lib/supabase/server'
import {
  forgotPasswordSchema,
  loginSchema,
  NOT_ADMIN_MESSAGE,
  sanitizeNextPath,
  setPasswordSchema,
} from '@/lib/validation/auth'

/**
 * 관리자 인증 서버 액션.
 *
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출된다(Next 문서 경고). 따라서
 * 모든 액션이 입력을 스스로 다시 검증하고, 권한도 스스로 확인한다.
 *
 * `redirect()` 는 내부적으로 예외를 던져 흐름을 끊는다. try/catch 안에서 부르면
 * 그 예외를 삼켜 리다이렉트가 사라지므로 항상 마지막 문장으로만 쓴다.
 */

const ADMIN_ROLE = 'admin'

export async function signInAction(_prevState: FormState, formData: FormData): Promise<FormState> {
  const parsed = loginSchema.safeParse({
    email: readField(formData, 'email'),
    password: readField(formData, 'password'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const nextPath = sanitizeNextPath(readField(formData, 'next'))
  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error !== null || data.user === null) {
    /* 어느 쪽이 틀렸는지 알려 주지 않는다. 구분해서 답하면 이메일 존재 여부를
       확인하는 계정 열거(enumeration) 창구가 된다. */
    return { formError: '이메일 또는 비밀번호가 올바르지 않습니다.' }
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (profile === null || profile.role !== ADMIN_ROLE) {
    // 관리자가 아니면 세션을 남기지 않는다. 남기면 "로그인은 됐는데 아무것도
    // 못 하는" 상태로 갇히고, RLS 가 막는 화면만 계속 마주치게 된다.
    await supabase.auth.signOut()

    return { formError: NOT_ADMIN_MESSAGE }
  }

  redirect(nextPath)
}

export async function signOutAction(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()

  redirect('/login')
}

/**
 * 비밀번호 재설정 메일 발송.
 *
 * 성공/실패를 구분해 답하지 않는다 — "가입되지 않은 이메일입니다"는 그대로
 * 계정 열거 창구다. 실제 발송 실패는 서버 로그로만 남긴다.
 */
export async function requestPasswordResetAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = forgotPasswordSchema.safeParse({ email: readField(formData, 'email') })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${adminSiteUrl()}/auth/callback?next=/reset-password`,
  })

  if (error !== null) {
    console.error('[auth] 비밀번호 재설정 메일 발송 실패', error.message)
  }

  return {
    message: '입력하신 주소로 재설정 메일을 보냈습니다. 메일함을 확인해 주세요.',
  }
}

/**
 * 비밀번호 설정 — 재설정 링크와 초대 링크가 함께 쓴다.
 *
 * 링크를 통해 이미 세션이 만들어진 상태에서만 동작한다. 세션이 없으면 아무나
 * 남의 비밀번호를 바꿀 수 있으므로 `getUser()` 로 반드시 확인한다.
 */
export async function setPasswordAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = setPasswordSchema.safeParse({
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
    return {
      formError: '링크가 만료되었습니다. 비밀번호 재설정 메일을 다시 요청해 주세요.',
    }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error !== null) {
    /* 같은 비밀번호는 운영자가 바로 고칠 수 있는 입력 문제라 필드에 붙여 알린다. */
    if (error.code === 'same_password') {
      return { fieldErrors: { password: '이전과 다른 비밀번호를 입력해 주세요.' } }
    }

    return actionFailure(
      'auth',
      '비밀번호를 변경하지 못했습니다. 링크를 다시 받아 처음부터 진행해 주세요.',
      error,
    )
  }

  const nextPath = sanitizeNextPath(readField(formData, 'next'))

  redirect(nextPath)
}

/**
 * URL 프래그먼트(#access_token=…)로 돌아온 링크의 세션 확립.
 *
 * Supabase 가 PKCE(`?code=`)가 아닌 암시적 흐름으로 리다이렉트하면 토큰이 해시에
 * 담겨 오는데, 해시는 서버로 전송되지 않는다. 브라우저가 읽어 이 액션으로 넘기면
 * 서버가 `setSession()` 으로 **httpOnly 쿠키**에 옮긴다 — 토큰이 자바스크립트가
 * 접근 가능한 저장소에 남지 않는다.
 */
export async function establishSessionAction(
  accessToken: string,
  refreshToken: string,
): Promise<FormState> {
  if (accessToken === '' || refreshToken === '') {
    return { formError: '유효하지 않은 링크입니다.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })

  if (error !== null) {
    return { formError: '링크가 만료되었습니다. 다시 요청해 주세요.' }
  }

  return EMPTY_FORM_STATE
}
