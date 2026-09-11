'use server'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import {
  INQUIRY_NOT_FOUND_MESSAGE,
  applyStatusChange,
  cancelledGuard,
  readInquiryState,
  revalidateInquiry,
} from '@/lib/actions/inquiry-shared'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { inquiryAssignSchema, inquiryUnassignSchema } from '@/lib/validation/inquiry-assignment'

/**
 * 1:1 문의 담당자 배정.
 *
 * 두 액션 모두 스스로 `requirePermission('inquiries', 'write')` 을 부른다. 서버 액션은
 * UI 를 거치지 않는 직접 POST 로도 호출되므로, 화면의 버튼 유무는 인가가 아니다.
 *
 * 작성 중 잠금은 `inquiry-lock-actions.ts`, 내부 메모는 `inquiry-note-actions.ts` 가 갖는다
 * (한 파일에 모으면 300줄을 넘고, 셋은 서로를 부르지 않는다).
 */

/* -------------------------------------------------------------------------
 * 담당자 배정
 * ---------------------------------------------------------------------- */

/**
 * 담당자 지정(나에게 배정 · 담당자 변경 · 가로채기).
 *
 * 미배정이던 '접수 대기' 문의는 배정과 함께 '처리 중'으로 옮긴다. 담당자가 생겼는데
 * 상태가 여전히 '접수 대기'면, 사용자 화면에는 아무도 보지 않는 것처럼 남고 운영자
 * 큐에서도 미처리로 계속 눈에 띈다. 전이 규칙은 상태 select 와 **같은 표**를 탄다.
 */
export async function assignInquiryAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const parsed = inquiryAssignSchema.safeParse({
    inquiryId: readField(formData, 'inquiryId'),
    assigneeId: readField(formData, 'assigneeId'),
  })

  if (!parsed.success) {
    return { formError: Object.values(toFieldErrors(parsed.error))[0] ?? '잘못된 요청입니다.' }
  }

  const { inquiryId, assigneeId } = parsed.data
  const state = await readInquiryState(inquiryId)

  if (state === null) {
    return { formError: INQUIRY_NOT_FOUND_MESSAGE }
  }

  const blocked = cancelledGuard(state)

  if (blocked !== null) {
    return { formError: blocked }
  }

  if (state.assignedTo === assigneeId) {
    return { formError: '이미 이 운영자가 담당하고 있습니다.' }
  }

  const supabase = await createClient()
  const { data: assignee } = await supabase
    .from('profiles')
    .select('nickname, role')
    .eq('id', assigneeId)
    .maybeSingle()

  // 일반 회원을 담당자로 박아 넣는 직접 POST 를 막는다(select 에는 관리자만 있다).
  if (assignee === null || assignee.role !== 'admin') {
    return { formError: '관리자만 담당자로 지정할 수 있습니다.' }
  }

  const { error } = await supabase
    .from('inquiries')
    .update({ assigned_to: assigneeId, assigned_at: new Date().toISOString() })
    .eq('id', inquiryId)

  if (error !== null) {
    return actionFailure(
      'inquiries',
      '담당자를 지정하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry.assign',
    targetTable: 'inquiries',
    targetId: inquiryId,
    before: { assigned_to: state.assignedTo },
    after: { assigned_to: assigneeId, assignee_nickname: assignee.nickname },
  })

  /* 상태 전이는 실패해도 배정을 되돌리지 않는다 — 담당자는 이미 정해졌고, 그것이
     이 조작의 목적이다. 상태는 헤더의 select 로 직접 옮길 수 있다. */
  const shouldPromote = state.assignedTo === null && state.status === 'pending'
  const promotionFailure = shouldPromote
    ? await applyStatusChange(actor.id, inquiryId, 'pending', 'in_progress')
    : null

  revalidateInquiry(inquiryId)

  const isSelf = assigneeId === actor.id
  const who = isSelf ? '나에게' : `${assignee.nickname}(으)로`
  const promoted = shouldPromote && promotionFailure === null

  return {
    message: `담당자를 ${who} 지정했습니다.${promoted ? " 상태도 '처리 중'으로 옮겼습니다." : ''}`,
  }
}

/** 배정 해제. 상태는 건드리지 않는다 — 담당자가 빠졌다고 처리가 되돌아가지는 않는다. */
export async function unassignInquiryAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const parsed = inquiryUnassignSchema.safeParse({ inquiryId: readField(formData, 'inquiryId') })

  if (!parsed.success) {
    return { formError: INQUIRY_NOT_FOUND_MESSAGE }
  }

  const { inquiryId } = parsed.data
  const state = await readInquiryState(inquiryId)

  if (state === null) {
    return { formError: INQUIRY_NOT_FOUND_MESSAGE }
  }

  if (state.assignedTo === null) {
    return { formError: '이미 담당자가 없습니다.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('inquiries')
    .update({ assigned_to: null, assigned_at: null })
    .eq('id', inquiryId)

  if (error !== null) {
    return actionFailure(
      'inquiries',
      '배정을 해제하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry.unassign',
    targetTable: 'inquiries',
    targetId: inquiryId,
    before: { assigned_to: state.assignedTo },
    after: { assigned_to: null },
  })

  revalidateInquiry(inquiryId)

  return { message: '담당자 배정을 해제했습니다.' }
}
