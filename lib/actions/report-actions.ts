'use server'

import { redirect } from 'next/navigation'

import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { isUniqueViolation } from '@/lib/actions/pg-error'
import {
  cooldownMessage,
  REPORT_COOLDOWN_SECONDS,
  remainingCooldown,
} from '@/lib/actions/rate-limit'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  duplicateReportMessage,
  REPORT_FAILURE_MESSAGE,
  REPORT_SELF_MESSAGE,
  REPORT_SUCCESS_MESSAGE,
} from '@/lib/constants/report'
import { createClient } from '@/lib/supabase/server'
import { isAuthor } from '@/lib/utils/authorship'
import { sanitizeNextPath } from '@/lib/validation/auth'
import { reportSchema } from '@/lib/validation/report'

import type { FormState } from '@/lib/actions/form-state'
import type { ReportTargetType } from '@/lib/constants/report'
import type { TypedSupabaseClient } from '@/lib/supabase/types'

/**
 * 신고 접수 서버 액션.
 *
 * 검사는 세 겹이다.
 *   1) 여기(세션 · 자기 글 · 도배) — 사용자에게 이유를 알려 주기 위해.
 *   2) `reports_insert_own` 정책 + `can_report_target()` — 직접 POST 우회 차단.
 *   3) `reports_unique_reporter` 유니크 제약 — 동시 요청 경합까지 막는다.
 *
 * 어떤 경로에서도 Supabase 원문 오류를 그대로 돌려주지 않는다. 제약 이름과
 * 스키마 구조가 그대로 새어 나가기 때문이다.
 */

const NOT_FOUND_MESSAGE = '대상을 찾을 수 없습니다. 이미 삭제되었을 수 있습니다.'

type TargetLookup = { found: boolean; authorId: string | null }

/** 사용자의 마지막 신고 시각. 도배 방지 판정에만 쓴다. */
async function getLatestReportAt(
  supabase: TypedSupabaseClient,
  reporterId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('reports')
    .select('created_at')
    .eq('reporter_id', reporterId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  return data?.created_at ?? null
}

/**
 * 신고 대상의 작성자.
 *
 * 행이 없는 것과 작성자가 없는 것(탈퇴 후 `author_id = null`)은 다른 상태라
 * `found` 로 구분해 돌려준다. 조회는 anon/authenticated 정책을 그대로 타므로
 * 비공개·삭제된 글은 애초에 `found: false` 가 된다.
 */
async function findTarget(
  supabase: TypedSupabaseClient,
  targetType: ReportTargetType,
  targetId: string,
): Promise<TargetLookup> {
  if (targetType === 'post') {
    const { data } = await supabase
      .from('posts')
      .select('author_id')
      .eq('id', targetId)
      .is('deleted_at', null)
      .maybeSingle()

    return { found: data !== null, authorId: data?.author_id ?? null }
  }

  const { data } = await supabase
    .from('comments')
    .select('author_id')
    .eq('id', targetId)
    .is('deleted_at', null)
    .maybeSingle()

  return { found: data !== null, authorId: data?.author_id ?? null }
}

export async function submitReport(_prevState: FormState, formData: FormData): Promise<FormState> {
  const nextPath = sanitizeNextPath(readField(formData, 'next'))
  const user = await getCurrentUser()

  if (user === null) {
    // 다이얼로그는 로그인 사용자에게만 열리지만, 액션은 직접 POST 로도 닿는다.
    redirect(`/login?next=${encodeURIComponent(nextPath)}`)
  }

  const parsed = reportSchema.safeParse({
    targetType: readField(formData, 'targetType'),
    targetId: readField(formData, 'targetId'),
    reason: readField(formData, 'reason'),
    detail: readField(formData, 'detail'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { targetType, targetId, reason, detail } = parsed.data
  const supabase = await createClient()
  const waitSeconds = remainingCooldown(
    await getLatestReportAt(supabase, user.id),
    Date.now(),
    REPORT_COOLDOWN_SECONDS,
  )

  if (waitSeconds > 0) {
    return { formError: cooldownMessage(waitSeconds) }
  }

  const target = await findTarget(supabase, targetType, targetId)

  if (!target.found) {
    return { formError: NOT_FOUND_MESSAGE }
  }

  if (isAuthor(target.authorId, user.id)) {
    return { formError: REPORT_SELF_MESSAGE }
  }

  const { error } = await supabase.from('reports').insert({
    target_type: targetType,
    target_id: targetId,
    reporter_id: user.id,
    reason,
    detail,
  })

  if (isUniqueViolation(error)) {
    return { formError: duplicateReportMessage(targetType) }
  }

  if (error !== null) {
    return { formError: REPORT_FAILURE_MESSAGE }
  }

  return { message: REPORT_SUCCESS_MESSAGE }
}
