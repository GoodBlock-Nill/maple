'use server'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import {
  INQUIRY_NOT_FOUND_MESSAGE,
  applyStatusChange,
  cancelledGuard,
  countInquiryReplies,
  readInquiryState,
  revalidateInquiry,
  snapshotConflict,
} from '@/lib/actions/inquiry-shared'
import { nullableArg } from '@/lib/actions/rpc-args'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { EMAIL_NOT_CONFIGURED_MESSAGE, sendInquiryReplyEmail } from '@/lib/email/send-inquiry-reply'
import { createClient } from '@/lib/supabase/server'
import { josa } from '@/lib/utils/josa'
import {
  INQUIRY_STATUS_LABELS,
  inquiryReplySchema,
  inquiryStatusSchema,
  isInquiryStatus,
} from '@/lib/validation/inquiries'
import { INQUIRY_CONFLICT_MESSAGE, parseInquirySnapshot } from '@/lib/validation/inquiry-assignment'

/**
 * 문의 상태 변경 · 답변 등록.
 *
 * 모든 액션이 스스로 `requirePermission('inquiries', 'write')` 을 부른다. 레이아웃이 이미 막고 있어도
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로 호출될 수 있다.
 *
 * 상태 전이는 화면과 같은 표(`INQUIRY_STATUS_TRANSITIONS`)로 판정한다. select 에
 * 없는 값을 직접 보내도 여기서 걸린다.
 *
 * 조회·가드·상태 전이는 `inquiry-shared.ts` 가 갖는다 — 배정 액션(협업)이 같은
 * 규칙으로 상태를 옮겨야 하기 때문이다(2026-09-11).
 */

const OPERATOR_NAME = '운영자'

/** 폼이 hidden 으로 실어 보낸 "화면을 연 시점"의 스레드 상태. */
function readSnapshot(formData: FormData) {
  return parseInquirySnapshot(
    readField(formData, 'expectedReplyCount'),
    readField(formData, 'expectedStatus'),
  )
}

/** 상세 헤더의 상태 select · "종료" 버튼이 함께 쓰는 액션. */
export async function updateInquiryStatusAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
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
    return { formError: INQUIRY_NOT_FOUND_MESSAGE }
  }

  const blocked = cancelledGuard(state)

  if (blocked !== null) {
    return { formError: blocked }
  }

  /* 화면을 연 뒤 다른 운영자가 먼저 움직였는지 본다. 상태 전이 자체는 아래에서
     `.eq('status', from)` 로 한 번 더 막지만, 그것만으로는 "왜 안 됐는지"를
     운영자에게 말해 줄 수 없다. */
  const snapshot = readSnapshot(formData)
  const conflict = snapshotConflict(snapshot, {
    status: state.status,
    replyCount: snapshot.replyCount === null ? 0 : await countInquiryReplies(inquiryId),
  })

  if (conflict !== null) {
    return { formError: conflict, code: 'conflict' }
  }

  if (state.status === status) {
    return { formError: '이미 같은 상태입니다. 상태는 바뀌지 않았습니다.' }
  }

  const failure = await applyStatusChange(actor.id, inquiryId, state.status, status)

  if (failure !== null) {
    return { formError: failure }
  }

  revalidateInquiry(inquiryId)

  const label = INQUIRY_STATUS_LABELS[status]

  return { message: `상태를 '${label}'${josa(label, '로')} 바꿨습니다.` }
}

/** `add_inquiry_reply()` 의 jsonb 응답. 모르는 모양은 실패로 떨어뜨린다. */
type ReplyResult = { ok: boolean; code: string | null; replyId: string | null }

function readReplyResult(value: unknown): ReplyResult {
  if (typeof value !== 'object' || value === null) {
    return { ok: false, code: null, replyId: null }
  }

  const record = value as Record<string, unknown>

  return {
    ok: record.ok === true,
    code: typeof record.code === 'string' ? record.code : null,
    replyId: typeof record.reply_id === 'string' ? record.reply_id : null,
  }
}

/**
 * 답변 등록.
 *
 * INSERT 는 `add_inquiry_reply()` RPC 가 한다. 앱에서 "확인 → INSERT" 두 번 왕복하면
 * 그 사이에 다른 운영자의 답변이 끼어들어 **두 답변이 모두 통과한다.** 함수 안에서
 * 문의 행을 잠그고 비교하므로, 화면을 연 시점과 달라졌으면 `conflict` 로 돌아온다.
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
  const actor = await requirePermission('inquiries', 'write')
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
    return { formError: INQUIRY_NOT_FOUND_MESSAGE }
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
  const isEmail = state.source === 'email'
  const snapshot = readSnapshot(formData)
  const { data, error } = await supabase.rpc('add_inquiry_reply', {
    p_inquiry_id: inquiryId,
    p_content: content,
    p_author_name: authorName,
    /* 기대값이 null 이면 함수가 비교를 건너뛴다(옛 탭 · 직접 POST). */
    p_expected_reply_count: nullableArg(snapshot.replyCount),
    // enum 캐스팅이 실패하면 22P02 다. 모르는 값은 "비교하지 않음"으로 내린다.
    p_expected_status: nullableArg(isInquiryStatus(snapshot.status) ? snapshot.status : null),
    /* 발송은 저장 뒤에 따로 일어난다. 먼저 'queued' 로 적어 두면 발송이 실패해도
       스레드에 "대기"로 남아 다시 보내기를 누를 수 있다. */
    p_delivery_status: nullableArg(isEmail ? 'queued' : null),
  })

  if (error !== null) {
    return actionFailure(
      'inquiries',
      '답변을 등록하지 못했습니다. 작성한 내용은 그대로 있으니 잠시 후 다시 저장해 주세요.',
      error,
    )
  }

  const result = readReplyResult(data)

  if (!result.ok || result.replyId === null) {
    return replyRejection(result)
  }

  await writeAuditLog(actor.id, {
    action: isEmail ? 'inquiry.email.reply' : 'inquiry.reply',
    targetTable: 'inquiry_replies',
    targetId: result.replyId,
    after: { inquiry_id: inquiryId, author_name: authorName, length: content.length },
  })

  const nextLabel = INQUIRY_STATUS_LABELS[nextStatus]
  const statusFailure =
    state.status === nextStatus
      ? null
      : await applyStatusChange(actor.id, inquiryId, state.status, nextStatus)

  revalidateInquiry(inquiryId)

  if (statusFailure !== null) {
    // 답변은 이미 남았다. 되돌리지 않고 상태만 실패했음을 정확히 알린다.
    return actionFailure(
      'inquiries',
      `답변은 등록했지만 상태를 바꾸지 못했습니다. 상태를 직접 ${nextLabel}${josa(nextLabel, '로')} 바꿔 주세요.`,
      statusFailure,
    )
  }

  if (!isEmail) {
    return { message: `답변을 등록하고 상태를 '${nextLabel}'${josa(nextLabel, '로')} 바꿨습니다.` }
  }

  return sendReplyMail(result.replyId, nextLabel)
}

/**
 * RPC 가 거절한 이유를 운영자 문구로 옮긴다.
 *
 * `conflict` 에는 **코드까지 함께** 돌려준다 — 화면이 스레드만 조용히 새로 고치고
 * 작성 중인 초안은 그대로 두어야 하는데, 문구 비교로 그 분기를 만들면 문구를
 * 다듬는 순간 동작이 깨진다.
 */
function replyRejection(result: ReplyResult): FormState {
  if (result.code === 'conflict') {
    return { formError: INQUIRY_CONFLICT_MESSAGE, code: 'conflict' }
  }

  if (result.code === 'cancelled') {
    return {
      formError: '사용자가 접수를 취소한 문의입니다. 상태 변경과 답변 등록을 할 수 없습니다.',
    }
  }

  if (result.code === 'not_found') {
    return { formError: INQUIRY_NOT_FOUND_MESSAGE }
  }

  return actionFailure(
    'inquiries',
    '답변을 등록하지 못했습니다. 작성한 내용은 그대로 있으니 잠시 후 다시 저장해 주세요.',
    `add_inquiry_reply 가 알 수 없는 응답을 돌려주었습니다(code=${result.code ?? '없음'})`,
  )
}

/**
 * 이메일 문의의 발송 결과를 운영자 문구로 옮긴다.
 *
 * 이 함수가 불릴 때 **답신은 이미 저장됐고 상태도 옮겨졌다.** 그러니 실패 문구는
 * "보내지 못했다"만 말하지 말고 지금 상태(저장됨)와 다음 행동(다시 보내기)을 함께 적는다 —
 * 그러지 않으면 운영자가 같은 답신을 한 번 더 쓴다.
 */
async function sendReplyMail(replyId: string, nextLabel: string): Promise<FormState> {
  const result = await sendInquiryReplyEmail(replyId)

  if (result.ok) {
    return {
      message: `답신을 이메일로 보내고 상태를 '${nextLabel}'${josa(nextLabel, '로')} 바꿨습니다.`,
    }
  }

  if (result.reason === 'not_configured') {
    // 운영 설정이 아직 없는 정상적인 상태다. 개발자 로그를 남길 실패가 아니다.
    return { formError: EMAIL_NOT_CONFIGURED_MESSAGE }
  }

  return actionFailure(
    'inquiries',
    '답신은 저장했지만 메일을 보내지 못했습니다. 스레드에서 다시 보내기를 눌러 주세요.',
    result.detail,
  )
}
