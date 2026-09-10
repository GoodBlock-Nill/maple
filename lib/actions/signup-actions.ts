'use server'

import { redirect } from 'next/navigation'

import { AUTH_MESSAGE, toAuthErrorMessage } from '@/lib/auth/auth-error-messages'
import { resolvePostAuthPath } from '@/lib/auth/post-auth'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { sanitizeNextPath } from '@/lib/validation/auth'
import {
  newPasswordSchema,
  sendSignupCodeSchema,
  verifySignupCodeSchema,
} from '@/lib/validation/email-auth'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 이메일 인증번호 회원가입.
 *
 *   1) `sendSignupCode`   — 이미 가입된 주소인지 보고, 6자리 인증번호를 메일로 보낸다.
 *   2) `verifySignupCode` — 인증번호를 확인한다. **여기서 세션이 생긴다.**
 *   3) `completeSignup`   — 그 세션에 비밀번호를 붙이고 온보딩으로 넘긴다.
 *
 * 세 액션 모두 UI 를 거치지 않는 직접 POST 로도 호출될 수 있다(Next 16 문서).
 * 인자는 매번 스키마로 다시 파싱하고, 단계 판정도 서버 상태(세션)로만 한다 —
 * 화면이 보내 준 "인증 완료" 같은 값은 신뢰하지 않는다.
 */

const CODE_SENT_MESSAGE = '인증번호를 보냈습니다. 메일함을 확인해 주세요.'
const CODE_VERIFIED_MESSAGE = '이메일 인증이 완료되었습니다.'
const SEND_FAILED_MESSAGE = '인증번호를 보내지 못했습니다. 잠시 후 다시 시도해 주세요.'

/**
 * 이미 가입이 끝난 주소인지 본다.
 *
 * `signInWithOtp({ shouldCreateUser: true })` 는 인증번호를 보내는 순간 계정을
 * 만든다(미인증 상태). 그래서 "프로필 행이 있다 = 가입 완료" 가 아니다. 메일
 * 확인까지 마쳤는지(`email_confirmed_at`)를 Auth 쪽에서 한 번 더 확인한다.
 *
 * 탈퇴 대기(`deleted_at`, 파기 전)는 가입 완료로 본다 — 다시 로그인하면 복구
 * 화면으로 이어지므로 새로 가입시키면 안 된다.
 */
async function isRegisteredEmail(email: string): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, deleted_at, purged_at')
      .eq('email', email)
      .limit(5)

    for (const profile of profiles ?? []) {
      if (profile.deleted_at !== null && profile.purged_at === null) {
        return true
      }

      const { data } = await admin.auth.admin.getUserById(profile.id)

      if (typeof data.user?.email_confirmed_at === 'string') {
        return true
      }
    }

    return false
  } catch (error) {
    /* 서비스 롤 키가 없거나 Auth 조회가 실패한 경우. 여기서 막아 버리면 정상
       가입까지 멈추므로 통과시킨다 — 메일함을 여는 사람만 다음 단계로 가므로
       이 검사는 안내용이지 인증 수단이 아니다. */
    console.error('[signup] 가입 여부 확인 실패:', error instanceof Error ? error.message : error)

    return false
  }
}

/** 1단계 — 인증번호 발송. 성공하면 화면이 60초 재전송 대기를 시작한다. */
export async function sendSignupCode(email: string): Promise<FormState> {
  const parsed = sendSignupCodeSchema.safeParse({ email })

  if (!parsed.success) {
    return { fieldErrors: { email: parsed.error.issues[0]?.message ?? '' } }
  }

  if (await isRegisteredEmail(parsed.data.email)) {
    return { fieldErrors: { email: AUTH_MESSAGE.emailTaken } }
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data.email,
    options: { shouldCreateUser: true },
  })

  if (error !== null) {
    // 발송 실패는 대부분 주소 문제(예약 도메인·차단 목록)라 이메일 칸 아래에 붙인다.
    return { fieldErrors: { email: toAuthErrorMessage(error, SEND_FAILED_MESSAGE) } }
  }

  return { message: CODE_SENT_MESSAGE }
}

/** 2단계 — 인증번호 확인. 성공하면 이 주소의 세션 쿠키가 심긴다. */
export async function verifySignupCode(email: string, token: string): Promise<FormState> {
  const parsed = verifySignupCodeSchema.safeParse({ email, token })

  if (!parsed.success) {
    return { fieldErrors: { code: parsed.error.issues[0]?.message ?? '' } }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.verifyOtp({
    email: parsed.data.email,
    token: parsed.data.token,
    type: 'email',
  })

  if (error !== null || data.user === null) {
    return { fieldErrors: { code: toAuthErrorMessage(error, AUTH_MESSAGE.otpInvalid) } }
  }

  return { message: CODE_VERIFIED_MESSAGE }
}

/**
 * 3단계 — 비밀번호 설정.
 *
 * 2단계에서 만들어진 세션이 없으면 아무것도 하지 않는다. 화면 상태가 아니라
 * 세션이 "이 주소의 주인임"을 증명하는 유일한 근거다.
 */
export async function completeSignup(
  password: string,
  passwordConfirm: string,
  next?: string,
): Promise<FormState> {
  const parsed = newPasswordSchema.safeParse({ password, passwordConfirm })

  if (!parsed.success) {
    const [issue] = parsed.error.issues
    const field = issue?.path[0] === 'passwordConfirm' ? 'passwordConfirm' : 'password'

    return { fieldErrors: { [field]: issue?.message ?? '' } }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    return { formError: AUTH_MESSAGE.sessionRequired }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })

  if (error !== null) {
    return { formError: toAuthErrorMessage(error) }
  }

  const destination = await resolvePostAuthPath(supabase, user.id, sanitizeNextPath(next))

  // redirect() 는 예외를 던진다. try/catch 바깥에서 호출해야 한다(Next 16 문서).
  redirect(destination)
}
