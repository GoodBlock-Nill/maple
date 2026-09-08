'use server'

import { revalidatePath } from 'next/cache'

import { moderateTarget } from '@/lib/actions/moderation-actions'
import { suspendMember } from '@/lib/actions/members-actions'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { dismissReportSchema, resolveReportSchema } from '@/lib/validation/moderation'

import type { ContentTable, ReportAction, ReportStatus } from '@/lib/validation/moderation'

/**
 * 신고 처리 · 기각.
 *
 * 처리 메모는 `audit_logs.after.note` 에 남긴다 — `reports` 에 메모 컬럼이 없다.
 * (스키마 공백. 마이그레이션 권한이 없어 이번 작업에서는 컬럼을 추가하지 않는다.)
 *
 * 사용자 사이트 캐시는 **여기서 직접 태우지 않는다**. 신고 처리가 사용자 화면을
 * 바꾸는 경로는 숨김·삭제뿐이고, 그것은 `moderateTarget()` 이 수행하면서
 * `community-list` 태그를 이미 태운다(`lib/actions/moderation-actions.ts`).
 * 여기서 또 부르면 같은 태그를 두 번 비운다. `reports` 자체는 관리자 전용 테이블이라
 * 사용자 사이트가 읽지 않는다.
 */

const REPORTS_PATH = '/reports'
const MEMBERS_PATH = '/members'

function tableOf(targetType: string): ContentTable {
  return targetType === 'comment' ? 'comments' : 'posts'
}

type ReportRow = { id: string; target_type: string; target_id: string; status: string }

async function readReport(id: string): Promise<ReportRow | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reports')
    .select('id, target_type, target_id, status')
    .eq('id', id)
    .maybeSingle()

  return data
}

/** 같은 대상에 아직 열려 있는 신고 id(현재 건 포함). 일괄 종결에 쓴다. */
async function openReportIdsForTarget(report: ReportRow): Promise<string[]> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('reports')
    .select('id')
    .eq('target_type', report.target_type)
    .eq('target_id', report.target_id)
    .eq('status', 'open')

  return [...new Set([report.id, ...(data ?? []).map((row) => row.id)])]
}

/**
 * 신고 상태 변경 — **여기서만 서비스 롤을 쓴다.**
 *
 * `reports` 에는 `reports_update_admin` 정책이 있지만 테이블 GRANT 가
 * `select, insert` 뿐이라(20260908001100) 세션 클라이언트의 UPDATE 는 정책 평가
 * 전에 42501(permission denied)로 막힌다. 실측으로 확인했다. 마이그레이션으로
 * `grant update on public.reports to authenticated` 를 더하면 이 우회는 지워야 한다.
 *
 * 우회의 범위를 좁히기 위해 상태 컬럼만, 그것도 호출부가 `requireAdmin()` 을 통과한
 * 뒤에만 만진다.
 */
async function setReportStatus(
  ids: readonly string[],
  status: ReportStatus,
): Promise<string | null> {
  const supabase = createAdminClient()
  const { error } = await supabase
    .from('reports')
    .update({ status })
    .in('id', [...ids])

  return error === null ? null : error.message
}

/** 신고 대상의 작성자. 정지 조치는 이 사람에게 걸린다. */
async function targetAuthorId(report: ReportRow): Promise<string | null> {
  const supabase = await createClient()
  const table = tableOf(report.target_type)
  const { data } =
    table === 'posts'
      ? await supabase.from('posts').select('author_id').eq('id', report.target_id).maybeSingle()
      : await supabase.from('comments').select('author_id').eq('id', report.target_id).maybeSingle()

  return data?.author_id ?? null
}

export async function resolveReportAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const parsed = resolveReportSchema.safeParse({
    reportId: readField(formData, 'reportId'),
    action: readField(formData, 'action'),
    note: readField(formData, 'note'),
    period: readField(formData, 'period') === '' ? undefined : readField(formData, 'period'),
    suspensionReason: readField(formData, 'suspensionReason'),
    applyToTarget: readField(formData, 'applyToTarget') === '1' ? '1' : '0',
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { reportId, action, note, period, suspensionReason, applyToTarget } = parsed.data
  const report = await readReport(reportId)

  if (report === null) {
    return { formError: '신고를 찾을 수 없습니다.' }
  }

  const failure = await applyReportAction(report, action, period, suspensionReason)

  if (failure !== null) {
    return { formError: failure }
  }

  const ids = applyToTarget ? await openReportIdsForTarget(report) : [reportId]
  const statusError = await setReportStatus(ids, 'resolved')

  if (statusError !== null) {
    return { formError: `신고 상태를 바꾸지 못했습니다. ${statusError}` }
  }

  await writeAuditLog(actor.id, {
    action: 'report.resolve',
    targetTable: 'reports',
    targetId: reportId,
    before: { status: report.status },
    after: {
      status: 'resolved',
      /* 메모 컬럼이 없어 여기에 남긴다. 감사 로그가 사실상 처리 기록의 원본이다. */
      note,
      moderation: action,
      report_ids: ids,
      target: { type: report.target_type, id: report.target_id },
    },
  })

  revalidatePath(REPORTS_PATH)

  return { message: `신고 ${ids.length}건을 처리했습니다.` }
}

/** 조치 실행. 실패 메시지를 돌려주면 상태를 바꾸지 않는다(조치 없이 종결되는 것을 막는다). */
async function applyReportAction(
  report: ReportRow,
  action: ReportAction,
  period: Parameters<typeof suspendMember>[1] | undefined,
  suspensionReason: string | undefined,
): Promise<string | null> {
  if (action === 'none') {
    return null
  }

  if (action === 'hide' || action === 'delete') {
    return moderateTarget(tableOf(report.target_type), report.target_id, action)
  }

  const authorId = await targetAuthorId(report)

  if (authorId === null) {
    return '대상의 작성자를 찾을 수 없습니다(탈퇴했거나 삭제된 글입니다).'
  }

  if (period === undefined || suspensionReason === undefined) {
    return '정지 기간과 사유가 필요합니다.'
  }

  const error = await suspendMember(authorId, period, suspensionReason)

  if (error === null) {
    revalidatePath(`${MEMBERS_PATH}/${authorId}`)
  }

  return error
}

export async function dismissReportAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const parsed = dismissReportSchema.safeParse({
    reportId: readField(formData, 'reportId'),
    note: readField(formData, 'note'),
    applyToTarget: readField(formData, 'applyToTarget') === '1' ? '1' : '0',
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { reportId, note, applyToTarget } = parsed.data
  const report = await readReport(reportId)

  if (report === null) {
    return { formError: '신고를 찾을 수 없습니다.' }
  }

  const ids = applyToTarget ? await openReportIdsForTarget(report) : [reportId]
  const statusError = await setReportStatus(ids, 'dismissed')

  if (statusError !== null) {
    return { formError: `신고를 기각하지 못했습니다. ${statusError}` }
  }

  await writeAuditLog(actor.id, {
    action: 'report.dismiss',
    targetTable: 'reports',
    targetId: reportId,
    before: { status: report.status },
    after: {
      status: 'dismissed',
      note,
      report_ids: ids,
      target: { type: report.target_type, id: report.target_id },
    },
  })

  revalidatePath(REPORTS_PATH)

  return { message: `신고 ${ids.length}건을 기각했습니다.` }
}
