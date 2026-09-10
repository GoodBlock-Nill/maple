'use server'

import { redirect } from 'next/navigation'

import {
  accountUniqueViolationFieldErrors,
  mswAccountFieldsForWrite,
} from '@/lib/actions/account-fields'
import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { isUniqueViolation } from '@/lib/actions/pg-error'
import { resolvePostAuthPath } from '@/lib/auth/post-auth'
import { ONBOARDING_COPY } from '@/lib/content/onboarding'
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
 * 이메일·비밀번호 로그인과 인증번호 회원가입은 2026-09-10 시안(auth-v2)과 함께
 * 제거되었다. 마이페이지의 프로필 저장은 `lib/actions/profile-actions.ts`,
 * 비밀번호 변경은 `lib/actions/password-actions.ts` 가 담당한다(파일 300줄 한도).
 *
 * TODO(auth): 지금 버튼은 **스텁**이다. 누르면 실제 제공자를 거치지 않고 곧바로
 * 로그인된다. 개발팀이 실 OAuth 를 붙이면 `SOCIAL_LOGIN_MODE=oauth` 로 바꾸고
 * `signInWithOAuth` 경로를 채운다. UI 는 그대로 둔다.
 *
 * 화면에 있는 버튼은 구글·네이버 둘뿐이지만(시안에서 카카오는 숨김) 제공자
 * 목록에는 카카오가 남아 있다 — 이미 카카오로 가입한 계정의 세션·아바타 처리가
 * 그대로 살아 있어야 한다.
 */

const LOGIN_PATH = '/login'

const NOT_READY_MESSAGE = '아직 준비 중인 로그인 방식입니다.'
const GENERIC_FAILURE_MESSAGE = '로그인에 실패했습니다. 잠시 후 다시 시도해 주세요.'

/** 체크박스는 체크했을 때만 FormData 에 담긴다. 값 자체("on")는 보지 않는다. */
function readCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) !== null
}

/**
 * 닉네임 중복 안내를 회원가입 시안 문구로 바꾼다.
 *
 * 같은 충돌을 마이페이지는 "이미 사용 중인 닉네임입니다."로 알린다. 두 화면의
 * 어미가 달라(시안 27:5222 는 "…이에요") 공용 상수를 고치는 대신 이 화면에서만
 * 옮겨 적는다 — 마이페이지 시안 문구까지 함께 흔들리지 않게.
 */
function withOnboardingNicknameCopy(fieldErrors: Record<string, string>): Record<string, string> {
  if (fieldErrors.nickname === undefined) {
    return fieldErrors
  }

  return { ...fieldErrors, nickname: ONBOARDING_COPY.nicknameTaken }
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
    marketingAgreed: readCheckbox(formData, 'marketingAgreed'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  /* 마케팅 동의는 "수신거부" 두 컬럼으로 뒤집어 저장한다. 동의하면 두 채널 모두
     열고(false), 체크하지 않았으면 둘 다 닫는다(true). 컬럼 기본값은 false 라
     체크하지 않은 사람을 그대로 두면 "동의한 적 없는데 수신"이 된다. */
  const optOut = !parsed.data.marketingAgreed
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('profiles')
    .update({
      nickname: parsed.data.nickname,
      ...mswAccountFieldsForWrite(parsed.data),
      terms_agreed_at: now,
      privacy_agreed_at: now,
      age_confirmed_at: now,
      marketing_sms_opt_out: optOut,
      marketing_email_opt_out: optOut,
    })
    .eq('id', user.id)

  if (error !== null) {
    const fieldErrors = isUniqueViolation(error) ? accountUniqueViolationFieldErrors(error) : null

    if (fieldErrors !== null) {
      return { fieldErrors: withOnboardingNicknameCopy(fieldErrors) }
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

/**
 * 회원가입 실패 카드의 "로그인으로 돌아가기".
 *
 * 온보딩을 마치지 못한 세션은 살아 있어도 글쓰기·댓글이 열리지 않는 반쪽 계정이라
 * 그대로 두면 헤더만 로그인 상태로 남는다. 세션을 끊고 로그인 화면으로 돌려보낸다.
 * 홈으로 가는 `signOut()` 과 목적지만 다르다.
 */
export async function signOutToLogin(): Promise<void> {
  const supabase = await createClient()
  await supabase.auth.signOut()

  redirect(LOGIN_PATH)
}
