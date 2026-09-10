'use server'

import { redirect } from 'next/navigation'

import {
  accountUniqueViolationFieldErrors,
  mswAccountFieldsForWrite,
} from '@/lib/actions/account-fields'
import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { isUniqueViolation } from '@/lib/actions/pg-error'
import { resolvePostAuthPath } from '@/lib/auth/post-auth'
import { createClient } from '@/lib/supabase/server'
import { markStubProvider, signInWithStubProvider } from '@/lib/supabase/stub-social'
import {
  isSocialProvider,
  onboardingSchema,
  ONBOARDING_PATH,
  parseSocialLoginMode,
  sanitizePostAuthPath,
} from '@/lib/validation/auth'

import type { FormState } from '@/lib/actions/form-state'
import type { SocialProvider } from '@/lib/validation/auth'

/**
 * 인증 서버 액션 — 간편로그인 · 온보딩 · 로그아웃.
 *
 * 이메일·비밀번호 로그인과 인증번호 회원가입은 `lib/actions/email-auth-actions.ts`
 * 와 `lib/actions/signup-actions.ts` 가, 마이페이지의 프로필 저장은
 * `lib/actions/profile-actions.ts` 가 담당한다(파일 300줄 한도).
 *
 * TODO(auth): 지금 세 버튼은 **스텁**이다. 누르면 실제 제공자를 거치지 않고 곧바로
 * 로그인된다. 개발팀이 실 OAuth 를 붙이면 `SOCIAL_LOGIN_MODE=oauth` 로 바꾸고
 * `signInWithOAuth` 경로를 채운다. UI 는 그대로 둔다.
 */

const LOGIN_PATH = '/login'

const NOT_READY_MESSAGE = '아직 준비 중인 로그인 방식입니다.'
const GENERIC_FAILURE_MESSAGE = '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.'

/** 체크박스는 체크했을 때만 FormData 에 담긴다. 값 자체("on")는 보지 않는다. */
function readCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) !== null
}

/**
 * 간편로그인 버튼의 폼 액션.
 *
 * `useActionState` 로 오류를 화면에 그리기 위해 FormData 를 받는 얇은 껍데기다.
 * 실제 로직은 `stubSocialSignIn` 에 있다.
 */
export async function socialSignIn(_prevState: FormState, formData: FormData): Promise<FormState> {
  const provider = readField(formData, 'provider')

  if (!isSocialProvider(provider)) {
    return { formError: NOT_READY_MESSAGE }
  }

  return stubSocialSignIn(provider, readField(formData, 'next'))
}

/**
 * 스텁 간편로그인.
 *
 * TODO(auth): 개발팀 실 OAuth 연동 시 교체.
 *
 * 성공하면 세션 쿠키가 심긴 채 온보딩(최초 로그인) 또는 `next` 로 이동한다.
 * 실패는 문구 하나로만 알린다 — 내부 오류를 그대로 노출하지 않는다.
 */
export async function stubSocialSignIn(
  provider: SocialProvider,
  next?: string,
): Promise<FormState> {
  // 서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출된다. 인자를 다시 검증한다.
  if (!isSocialProvider(provider)) {
    return { formError: NOT_READY_MESSAGE }
  }

  if (parseSocialLoginMode(process.env.SOCIAL_LOGIN_MODE) === 'oauth') {
    // 실 OAuth 모드인데 아직 제공자가 연결되지 않은 상태. 500 대신 안내를 준다.
    return { formError: NOT_READY_MESSAGE }
  }

  const supabase = await createClient()
  const result = await signInWithStubProvider(supabase, provider)

  if (!result.ok) {
    return { formError: result.message }
  }

  await markStubProvider(result.userId, provider)

  const destination = await resolvePostAuthPath(supabase, result.userId, next)

  // redirect() 는 예외를 던진다. try/catch 바깥에서 호출해야 한다(Next 16 문서).
  redirect(destination)
}

/**
 * 최초 로그인 온보딩 완료.
 *
 * 닉네임·메이플스토리 월드 UID·프로필 코드를 확정하고 이용약관·개인정보처리방침
 * 동의와 만 14세 이상 확인을 남긴다. 개인정보처리방침 제11조상 만 14세 미만은
 * 가입할 수 없으므로 세 동의 항목 모두 필수다.
 */
export async function completeOnboarding(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(ONBOARDING_PATH)}`)
  }

  const nextPath = sanitizePostAuthPath(readField(formData, 'next'))
  const parsed = onboardingSchema.safeParse({
    nickname: readField(formData, 'nickname'),
    mswUid: readField(formData, 'mswUid'),
    mswProfileCode: readField(formData, 'mswProfileCode'),
    termsAgreed: readCheckbox(formData, 'termsAgreed'),
    privacyAgreed: readCheckbox(formData, 'privacyAgreed'),
    ageConfirmed: readCheckbox(formData, 'ageConfirmed'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const now = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({
      nickname: parsed.data.nickname,
      ...mswAccountFieldsForWrite(parsed.data),
      terms_agreed_at: now,
      privacy_agreed_at: now,
      age_confirmed_at: now,
    })
    .eq('id', user.id)

  if (error !== null) {
    const fieldErrors = isUniqueViolation(error) ? accountUniqueViolationFieldErrors(error) : null

    if (fieldErrors !== null) {
      return { fieldErrors }
    }

    return { formError: GENERIC_FAILURE_MESSAGE }
  }

  redirect(nextPath)
}

export async function signOut(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()

  redirect('/')
}
