'use server'

import { redirect } from 'next/navigation'

import { readField } from '@/lib/actions/form-state'
import {
  canRestoreProfile,
  isWithdrawnProfile,
  PURGED_ACCOUNT_MESSAGE,
  WITHDRAWN_NOTICE_PARAM,
  WITHDRAWN_NOTICE_VALUE,
} from '@/lib/auth/lifecycle'
import { createClient } from '@/lib/supabase/server'
import { ACCOUNT_PATH, RESTORE_PATH, sanitizePostAuthPath } from '@/lib/validation/auth'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 회원 탈퇴 · 복구 서버 액션.
 *
 * 두 액션 모두 **세션 클라이언트**로 자기 프로필의 `deleted_at` 만 바꾼다.
 * 허용 범위는 DB 가 정한다 — `profiles_update_self` 정책(본인 행) +
 * `guard_profile_role()` 트리거(deleted_at 은 now() 로 채우거나 비우는 것만, purged_at
 * 은 손대지 못함). 감사 로그(`member.withdraw` · `member.restore`)는 트리거
 * `log_profile_lifecycle` 이 남기므로 여기서 따로 쓰지 않는다 — 사용자 사이트는
 * `audit_logs` 에 직접 쓸 권한이 없다(`audit_logs_insert_admin`).
 *
 * 설계: docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md §3 · §4.2.
 */

const LOGIN_PATH = '/login'

const WITHDRAW_FAILURE_MESSAGE =
  '탈퇴를 처리하지 못했습니다. 계정은 그대로입니다. 다시 시도해 주세요.'
const RESTORE_FAILURE_MESSAGE =
  '계정을 복구하지 못했습니다. 탈퇴 상태는 그대로입니다. 다시 시도해 주세요.'

/**
 * 회원 탈퇴 — `deleted_at = now()` 를 찍고 세션을 끊은 뒤 홈으로 보낸다.
 *
 * 성공 처리(안내)는 리다이렉트로 끝난다(`/?notice=withdrawn`). 리다이렉트로 끝나는
 * 액션의 성공 메시지를 컴포넌트에서 다루면 리다이렉트와 경합한다(DEVELOPER-GUIDE §7.4).
 */
export async function withdrawAccountAction(
  _prevState: FormState,
  _formData: FormData,
): Promise<FormState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(ACCOUNT_PATH)}`)
  }

  /* 갱신된 행을 되읽어 실제로 찍혔는지 본다 — 정책에 걸려 0행이 바뀌어도 PostgREST
     는 오류를 내지 않기 때문이다. 값 자체는 트리거가 now() 로 고정한다. */
  const { data, error } = await supabase
    .from('profiles')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', user.id)
    .select('deleted_at')
    .maybeSingle()

  if (error !== null || data === null || data.deleted_at === null) {
    return { formError: WITHDRAW_FAILURE_MESSAGE }
  }

  await supabase.auth.signOut()

  // redirect() 는 예외를 던진다. try/catch 바깥, 성공 경로의 마지막에서 호출한다.
  redirect(`/?${WITHDRAWN_NOTICE_PARAM}=${WITHDRAWN_NOTICE_VALUE}`)
}

/**
 * 계정 복구 — 90일 안에 같은 간편로그인 계정으로 다시 로그인한 사람이 "계정 복구"를
 * 누르면 `deleted_at` 을 비운다. 제재(`suspended_until`)는 건드리지 않으므로 복구 뒤
 * 그대로 적용된다(피드백 4).
 */
export async function restoreAccountAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const nextPath = sanitizePostAuthPath(readField(formData, 'next'))
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(RESTORE_PATH)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('deleted_at, purged_at')
    .eq('id', user.id)
    .maybeSingle()

  // 이미 정상 회원이면(다른 탭에서 복구했다) 그대로 통과시킨다.
  if (!isWithdrawnProfile(profile)) {
    redirect(nextPath)
  }

  if (!canRestoreProfile(profile)) {
    return { formError: PURGED_ACCOUNT_MESSAGE }
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({ deleted_at: null })
    .eq('id', user.id)
    .select('deleted_at')
    .maybeSingle()

  if (error !== null || data === null || data.deleted_at !== null) {
    return { formError: RESTORE_FAILURE_MESSAGE }
  }

  redirect(nextPath)
}
