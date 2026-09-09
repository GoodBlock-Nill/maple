'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure, logFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { josa } from '@/lib/utils/josa'
import {
  INQUIRY_STATUS_LABELS,
  canTransitionInquiryStatus,
  inquiryReplySchema,
  inquiryStatusSchema,
  isCancelledInquiry,
  type InquiryStatus,
} from '@/lib/validation/inquiries'

/**
 * 문의 상태 변경 · 답변 등록.
 *
 * 모든 액션이 스스로 `requireAdmin()` 을 부른다. 레이아웃이 이미 막고 있어도
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있다.
 *
 * 상태 전이는 화면과 같은 표(`INQUIRY_STATUS_TRANSITIONS`)로 판정한다. select 에
 * 없는 값을 직접 보내도 여기서 걸린다.
 */

const LIST_PATH = '/inquiries'

const OPERATOR_NAME = '운영자'

function detailPath(inquiryId: string): string {
  return `${LIST_PATH}/${inquiryId}`
}

type InquiryState = {
  status: InquiryStatus
  /** 사용자가 접수를 취소한 시각. 있으면 운영자 조작을 모두 막는다. */
  cancelledAt: string | null
}

async function readInquiryState(inquiryId: string): Promise<InquiryState | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('inquiries')
    .select('status, cancelled_at')
    .eq('id', inquiryId)
    .maybeSingle()

  if (data === null) {
    return null
  }

  return { status: data.status, cancelledAt: data.cancelled_at }
}

/**
 * 사용자가 취소한 문의는 읽기 전용이다.
 *
 * 취소된 접수에 답변이 붙거나 상태가 되살아나면, 사용자 화면에는 "취소했는데 처리
 * 중"인 문의가 남는다. 화면에서도 잠그지만 액션이 마지막 방어선이다.
 */
function cancelledGuard(state: InquiryState): string | null {
  return isCancelledInquiry(state.cancelledAt)
    ? '사용자가 접수를 취소한 문의입니다. 상태 변경과 답변 등록을 할 수 없습니다.'
    : null
}

/**
 * 상태 전이 1건. 성공하면 null, 실패하면 사용자에게 보여 줄 문구를 돌려준다.
 *
 * `answered_at` 은 처음 답변 완료로 넘어간 시각만 남긴다. 다시 답변 완료가 될 때마다
 * 갱신하면 "첫 응답까지 걸린 시간"을 나중에 계산할 수 없다.
 */
async function applyStatusChange(
  actorId: string,
  inquiryId: string,
  from: InquiryStatus,
  to: InquiryStatus,
): Promise<string | null> {
  if (!canTransitionInquiryStatus(from, to)) {
    return `${INQUIRY_STATUS_LABELS[from]} 상태에서는 ${INQUIRY_STATUS_LABELS[to]}${josa(INQUIRY_STATUS_LABELS[to], '로')} 바꿀 수 없습니다.`
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('inquiries')
    .update({
      status: to,
      ...(to === 'answered' ? { answered_at: new Date().toISOString() } : {}),
    })
    .eq('id', inquiryId)
    .eq('status', from)

  if (error !== null) {
    return logFailure(
      'inquiries',
      '상태를 바꾸지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actorId, {
    action: 'inquiry.status',
    targetTable: 'inquiries',
    targetId: inquiryId,
    before: { status: from },
    after: { status: to },
  })

  return null
}

/** 상세 헤더의 상태 select · "종료" 버튼이 함께 쓰는 액션. */
export async function updateInquiryStatusAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const parsed = inquiryStatusSchema.safeParse({
    inquiryId: readField(formData, 'inquiryId'),
    status: readField(formData, 'status'),
  })

  if (!parsed.success) {
    return { formError: Object.values(toFieldErrors(parsed.error))[0] ?? '잘못된 요청입니다.' }
  }

  const { inquiryId, status } = parsed.data
  const state = await readInquiryState(inquiryId)

  if (state === null) {
    return { formError: '문의를 찾을 수 없습니다.' }
  }

  const blocked = cancelledGuard(state)

  if (blocked !== null) {
    return { formError: blocked }
  }

  if (state.status === status) {
    return { formError: '이미 같은 상태입니다. 상태는 바뀌지 않았습니다.' }
  }

  const failure = await applyStatusChange(actor.id, inquiryId, state.status, status)

  if (failure !== null) {
    return { formError: failure }
  }

  revalidatePath(detailPath(inquiryId))
  revalidatePath(LIST_PATH)

  const label = INQUIRY_STATUS_LABELS[status]

  return { message: `상태를 '${label}'${josa(label, '로')} 바꿨습니다.` }
}

/**
 * 답변 등록.
 *
 * 답변을 넣은 뒤 상태를 옮긴다. 순서를 뒤집으면 상태만 '답변 완료'로 바뀌고 답변이
 * 실패하는 경우가 생겨, 사용자 화면에 "답변 완료인데 답변이 없는" 문의가 남는다.
 *
 * 종료된 문의는 답변할 수 없다. 사용자 화면에서 이미 닫힌 스레드에 글이 붙으면
 * 알림 없이 내용만 늘어난다 — 되살리려면 먼저 '처리 중'으로 되돌리게 한다.
 */
export async function replyToInquiryAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const parsed = inquiryReplySchema.safeParse({
    inquiryId: readField(formData, 'inquiryId'),
    content: readField(formData, 'content'),
    nextStatus: readField(formData, 'nextStatus'),
    useOperatorName: formData.get('useOperatorName') !== null,
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { inquiryId, content, nextStatus, useOperatorName } = parsed.data
  const state = await readInquiryState(inquiryId)

  if (state === null) {
    return { formError: '문의를 찾을 수 없습니다.' }
  }

  const blocked = cancelledGuard(state)

  if (blocked !== null) {
    return { formError: blocked }
  }

  if (state.status === 'closed') {
    return { formError: '종료된 문의에는 답변할 수 없습니다. 먼저 처리 중으로 되돌려 주세요.' }
  }

  const supabase = await createClient()
  const authorName = useOperatorName ? OPERATOR_NAME : actor.nickname
  const { data: reply, error } = await supabase
    .from('inquiry_replies')
    .insert({
      inquiry_id: inquiryId,
      author_id: actor.id,
      author_name: authorName,
      content,
    })
    .select('id')
    .single()

  if (error !== null) {
    return actionFailure(
      'inquiries',
      '답변을 등록하지 못했습니다. 작성한 내용은 그대로 있으니 잠시 후 다시 저장해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry.reply',
    targetTable: 'inquiry_replies',
    targetId: reply.id,
    after: { inquiry_id: inquiryId, author_name: authorName, length: content.length },
  })

  const nextLabel = INQUIRY_STATUS_LABELS[nextStatus]
  const statusFailure =
    state.status === nextStatus
      ? null
      : await applyStatusChange(actor.id, inquiryId, state.status, nextStatus)

  revalidatePath(detailPath(inquiryId))
  revalidatePath(LIST_PATH)

  if (statusFailure !== null) {
    // 답변은 이미 남았다. 되돌리지 않고 상태만 실패했음을 정확히 알린다.
    return actionFailure(
      'inquiries',
      `답변은 등록했지만 상태를 바꾸지 못했습니다. 상태를 직접 ${nextLabel}${josa(nextLabel, '로')} 바꿔 주세요.`,
      statusFailure,
    )
  }

  return { message: `답변을 등록하고 상태를 '${nextLabel}'${josa(nextLabel, '로')} 바꿨습니다.` }
}
