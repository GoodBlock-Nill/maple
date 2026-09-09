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
  isNativeSocialProvider,
  isSocialProvider,
  loginSchema,
  NOT_ADMIN_MESSAGE,
  parseSocialLoginMode,
  sanitizeNextPath,
  setPasswordSchema,
  SOCIAL_LOGIN_NAVER_MESSAGE,
  SOCIAL_LOGIN_STUB_MESSAGE,
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

/** 알 수 없는 제공자 값(직접 POST)으로 들어왔을 때. 내부 사정을 알려 주지 않는다. */
const UNKNOWN_PROVIDER_MESSAGE = '지원하지 않는 로그인 방식입니다.'

const OAUTH_START_FAILURE_MESSAGE = '간편로그인을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.'

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

/**
 * 간편로그인 버튼의 폼 액션.
 *
 * `useActionState` 로 오류를 그리기 위해 FormData 를 받는 얇은 껍데기다. 버튼
 * 세 개가 폼 하나를 공유하고, 눌린 버튼의 `name="provider"` 값만 실려 온다.
 */
export async function socialSignInFormAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  return socialSignInAction(readField(formData, 'provider'), readField(formData, 'next'))
}

/**
 * 간편로그인(구글·카카오·네이버) 시작.
 *
 * 관리자 앱은 **스텁 로그인을 만들지 않는다.** 사용자 사이트의 스텁은 없는 계정을
 * 즉시 만들어 주는데, 그걸 관리자에 두면 아무나 관리자 후보 계정을 찍어낼 수 있다.
 * 실 OAuth 가 붙기 전(`SOCIAL_LOGIN_MODE` 미설정 = `stub`)에는 안내만 돌려주고
 * 운영자는 아래의 이메일 로그인을 쓴다.
 *
 * 권한 검사는 여기서 하지 않는다 — 제공자를 다녀와야 누구인지 알 수 있다.
 * 돌아온 뒤 `app/auth/callback/route.ts` 가 `profiles.role` 을 확인한다.
 */
export async function socialSignInAction(provider: string, next?: string): Promise<FormState> {
  // 서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출된다. 인자를 다시 검증한다.
  if (!isSocialProvider(provider)) {
    return { formError: UNKNOWN_PROVIDER_MESSAGE }
  }

  if (parseSocialLoginMode(process.env.SOCIAL_LOGIN_MODE) !== 'oauth') {
    return { formError: SOCIAL_LOGIN_STUB_MESSAGE }
  }

  if (!isNativeSocialProvider(provider)) {
    // 네이버는 Supabase 기본 제공자가 아니다. 없는 제공자로 호출하면 400 이
    // 떨어지므로, 흉내 내지 말고 진행 상황을 그대로 알린다.
    return { formError: SOCIAL_LOGIN_NAVER_MESSAGE }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      /* 콜백은 관리자 도메인으로 돌아와야 한다. 이 주소가 Supabase Auth 의
         Redirect URLs 에 등록돼 있지 않으면 사용자 사이트로 튕긴다. */
      redirectTo: `${adminSiteUrl()}/auth/callback?next=${encodeURIComponent(sanitizeNextPath(next))}`,
    },
  })

  if (error !== null) {
    console.error('[auth] 간편로그인 시작 실패', provider, error.message)

    return { formError: OAUTH_START_FAILURE_MESSAGE }
  }

  // redirect() 는 예외를 던진다. try/catch 바깥, 마지막 문장으로만 부른다.
  redirect(data.url)
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
