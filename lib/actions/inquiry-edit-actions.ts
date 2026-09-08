'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { readFiles, removeAttachments, uploadAttachments } from '@/lib/actions/inquiry-attachments'
import { isRlsViolation } from '@/lib/actions/pg-error'
import {
  cooldownMessage,
  remainingCooldown,
  REPORT_COOLDOWN_SECONDS,
} from '@/lib/actions/rate-limit'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  INQUIRY_ATTACHMENT_REMOVE_FIELD,
  INQUIRY_CANCELLED_PARAM,
  INQUIRY_EDIT_LOCKED_NOTICE,
  INQUIRY_UPDATED_PARAM,
  MY_INQUIRIES_PATH,
} from '@/lib/constants/support'
import { toAttachments } from '@/lib/data/inquiries'
import { createClient } from '@/lib/supabase/server'
import { canCancelInquiry, canEditInquiry } from '@/lib/utils/inquiry-permissions'
import {
  inquiryIdSchema,
  updateInquirySchema,
  validateInquiryAttachments,
} from '@/lib/validation/inquiry'

import type { FormState } from '@/lib/actions/form-state'
import type { CurrentUser } from '@/lib/auth/current-user'
import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { InquiryAttachment, InquiryStatus } from '@/types/domain'

/**
 * 소유자 본인의 문의 수정 · 접수 취소.
 *
 * 접수(`inquiry-actions.ts`)와 파일을 나눈 이유는 규칙이 다르기 때문이다. 접수는
 * "누구나 한 건 넣는다"이고, 여기는 "이미 있는 행을 상태에 따라 좁게 고친다"다.
 *
 * 상태 판정을 서버에서 다시 하는 것은 화면 분기를 신뢰하지 않기 위해서고, 그마저
 * 최종 방어선이 아니다 — DB 가드(`guard_inquiry_owner_update()`)가 접수 대기가
 * 아닌 문의의 본문 변경과 취소 해제를 42501 로 거절한다. 세 겹을 두는 이유는
 * 화면·액션·DB 중 어느 하나가 바뀌어도 답변 근거가 조용히 뒤바뀌지 않게 하려는 것이다.
 */

const LOGIN_MESSAGE = '로그인 후 이용할 수 있습니다.'
const NOT_FOUND_MESSAGE = '문의를 찾을 수 없습니다.'
const CANCEL_LOCKED_MESSAGE = '접수 대기 또는 처리 중인 문의만 취소할 수 있습니다.'
const UPDATE_FAILURE_MESSAGE = '문의를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.'
const CANCEL_FAILURE_MESSAGE = '문의 접수를 취소하지 못했습니다. 잠시 후 다시 시도해 주세요.'

/** 재수정 최소 간격. 신고와 성격이 같아(연달아 누를 이유가 있다) 짧은 창을 재사용한다. */
const EDIT_COOLDOWN_SECONDS = REPORT_COOLDOWN_SECONDS

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const OWNED_COLUMNS = 'status, cancelled_at, attachments, created_at, updated_at'

type OwnedInquiry = {
  status: InquiryStatus
  cancelledAt: string | null
  attachments: readonly InquiryAttachment[]
  createdAt: string
  updatedAt: string
}

type Guard =
  | { ok: true; user: CurrentUser; supabase: TypedSupabaseClient; inquiry: OwnedInquiry }
  | { ok: false; state: FormState }

/**
 * 로그인 + 소유권 확인.
 *
 * `user_id` 조건을 직접 거는 이유는 관리자 세션 때문이다 — 관리자에게는 전체 행이
 * 열려 있어서 조건을 빼면 관리자가 이 액션으로 남의 문의를 "본인 수정"처럼 고칠 수 있다.
 */
async function requireOwnInquiry(id: string): Promise<Guard> {
  if (!inquiryIdSchema.safeParse(id).success) {
    return { ok: false, state: { formError: NOT_FOUND_MESSAGE } }
  }

  const user = await getCurrentUser()

  if (user === null) {
    return { ok: false, state: { formError: LOGIN_MESSAGE } }
  }

  const supabase = await createClient()
  const { data } = await supabase
    .from('inquiries')
    .select(OWNED_COLUMNS)
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (data === null) {
    return { ok: false, state: { formError: NOT_FOUND_MESSAGE } }
  }

  return {
    ok: true,
    user,
    supabase,
    inquiry: {
      status: data.status,
      cancelledAt: data.cancelled_at,
      attachments: toAttachments(data.attachments),
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  }
}

/**
 * 마지막 "수정" 시각. 한 번도 고치지 않았다면 null 이다.
 *
 * `updated_at` 을 그대로 쓰면 접수 직후(두 값이 같다) 첫 수정이 도배로 걸린다.
 * 접수 → 오타 발견 → 즉시 수정은 정상 행동이라 막지 않는다.
 */
function lastEditedAt(inquiry: OwnedInquiry): string | null {
  return inquiry.updatedAt === inquiry.createdAt ? null : inquiry.updatedAt
}

function detailPath(id: string): string {
  return `${MY_INQUIRIES_PATH}/${id}`
}

function revalidateInquiry(id: string): void {
  revalidatePath(MY_INQUIRIES_PATH)
  revalidatePath(detailPath(id))
}

/** 첨부 편집 결과. `kept` 는 그대로 둘 것, `removed` 는 저장에 성공하면 지울 것. */
type AttachmentSplit = {
  kept: readonly InquiryAttachment[]
  removed: readonly InquiryAttachment[]
}

function splitAttachments(
  attachments: readonly InquiryAttachment[],
  formData: FormData,
): AttachmentSplit {
  const requested = new Set(
    formData
      .getAll(INQUIRY_ATTACHMENT_REMOVE_FIELD)
      .filter((value): value is string => typeof value === 'string'),
  )

  return {
    kept: attachments.filter((attachment) => !requested.has(attachment.path)),
    removed: attachments.filter((attachment) => requested.has(attachment.path)),
  }
}

/**
 * 접수 대기 상태의 문의 수정.
 *
 * id 는 폼 필드가 아니라 bind 로 실어 받는다(필드로 두면 남의 문의 id 로 갈아
 * 끼운 POST 가 가능해진다 — 소유권 검사에 걸리지만 시도 자체를 만들지 않는다).
 */
export async function updateInquiry(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updateInquirySchema.safeParse({
    accountId: readField(formData, 'accountId'),
    category: readField(formData, 'category'),
    type: readField(formData, 'type'),
    title: readField(formData, 'title'),
    content: readField(formData, 'content'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const guard = await requireOwnInquiry(id)

  if (!guard.ok) {
    return guard.state
  }

  if (!canEditInquiry(guard.inquiry)) {
    return { formError: INQUIRY_EDIT_LOCKED_NOTICE }
  }

  const { kept, removed } = splitAttachments(guard.inquiry.attachments, formData)
  const files = readFiles(formData, 'attachments')
  const attachmentCheck = validateInquiryAttachments(files, kept.length)

  if (!attachmentCheck.ok) {
    return { fieldErrors: { attachments: attachmentCheck.message } }
  }

  const waitSeconds = remainingCooldown(
    lastEditedAt(guard.inquiry),
    Date.now(),
    EDIT_COOLDOWN_SECONDS,
  )

  if (waitSeconds > 0) {
    return { formError: cooldownMessage(waitSeconds) }
  }

  const uploaded = await uploadAttachments(guard.supabase, guard.user.id, files)

  if (!uploaded.ok) {
    return { formError: uploaded.message }
  }

  const { error } = await guard.supabase
    .from('inquiries')
    .update({
      account_id: parsed.data.accountId,
      category: parsed.data.category,
      type: parsed.data.type,
      title: parsed.data.title,
      content: parsed.data.content,
      attachments: [...kept, ...uploaded.attachments],
    })
    .eq('id', id)
    .eq('user_id', guard.user.id)

  if (error !== null) {
    // 방금 올린 파일만 되돌린다. 기존 첨부는 아직 행이 참조하고 있다.
    await removeAttachments(guard.supabase, uploaded.attachments)

    /* 42501 은 RLS 거절이자 DB 가드의 거절 코드다. 그 사이에 상태가 올라갔다는
       뜻이므로 "실패"가 아니라 "지금은 못 고친다"고 알린다. */
    return {
      formError: isRlsViolation(error) ? INQUIRY_EDIT_LOCKED_NOTICE : UPDATE_FAILURE_MESSAGE,
    }
  }

  /* 저장이 끝난 뒤에 지운다. 먼저 지우면 저장이 실패했을 때 행은 그대로인데
     파일만 사라져 첨부가 깨진 문의가 남는다. */
  await removeAttachments(guard.supabase, removed)

  revalidateInquiry(id)

  // redirect() 는 예외를 던지므로 성공 경로의 마지막에서 호출한다.
  redirect(`${detailPath(id)}?${INQUIRY_UPDATED_PARAM}=1`)
}

/**
 * 접수 취소.
 *
 * enum 에 값을 더하지 않고 `status = 'closed'` + `cancelled_at` 으로 표현한다.
 * 두 값은 **같은 UPDATE** 로 보내야 한다 — DB 가드가 둘을 한 묶음으로만 허용한다.
 */
export async function cancelInquiry(id: string, _prevState: FormState): Promise<FormState> {
  const guard = await requireOwnInquiry(id)

  if (!guard.ok) {
    return guard.state
  }

  if (!canCancelInquiry(guard.inquiry)) {
    return { formError: CANCEL_LOCKED_MESSAGE }
  }

  const { error } = await guard.supabase
    .from('inquiries')
    .update({ status: 'closed', cancelled_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', guard.user.id)

  if (error !== null) {
    return { formError: isRlsViolation(error) ? CANCEL_LOCKED_MESSAGE : CANCEL_FAILURE_MESSAGE }
  }

  revalidateInquiry(id)

  // 취소한 문의도 상세는 남는다(이력). 1회성 안내만 붙여 같은 화면으로 돌려보낸다.
  redirect(`${detailPath(id)}?${INQUIRY_CANCELLED_PARAM}=1`)
}
