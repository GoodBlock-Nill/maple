'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField } from '@/lib/actions/form-state'
import {
  claimFormUploads,
  readPendingUploads,
  UPLOAD_FORM_INVALID_MESSAGE,
} from '@/lib/actions/inquiry-uploads'
import { getCurrentUser } from '@/lib/auth/current-user'
import {
  INQUIRY_REPLIED_PARAM,
  INQUIRY_REPLY_ERROR_FIELD,
  INQUIRY_REPLY_LOGIN_MESSAGE,
  INQUIRY_REPLY_NOT_FOUND_MESSAGE,
  INQUIRY_USER_REPLY_MAX,
  INQUIRY_USER_REPLY_REQUIRED_MESSAGE,
  INQUIRY_USER_REPLY_TOO_LONG_MESSAGE,
} from '@/lib/constants/inquiry-thread'
import { MY_INQUIRIES_PATH } from '@/lib/constants/support'
import { createClient } from '@/lib/supabase/server'
import { parseUserReplyResult, userReplyErrorMessage } from '@/lib/utils/inquiry-thread'
import { inquiryIdSchema, normalizeCRLF } from '@/lib/validation/inquiry'
import { toUploadCandidates, validateInquiryAttachments } from '@/lib/validation/inquiry-upload'

import type { FormState } from '@/lib/actions/form-state'
import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type { UserReplyResult } from '@/lib/utils/inquiry-thread'
import type { PendingInquiryUpload } from '@/lib/validation/inquiry-upload'
import type { InquiryAttachment } from '@/types/domain'

/**
 * 회원 답장 — 운영자가 답한 문의에 같은 접수번호로 이어 쓴다.
 *
 * 쓰기 경로는 `add_inquiry_user_reply()` 하나뿐이다. `inquiry_replies` 에는 사용자
 * INSERT 정책이 **없고**(마이그레이션 20260914000400), 소유·상태·횟수 검사를 RLS 로는
 * 깔끔히 쓸 수 없어 함수 안으로 모았다. 그래서 이 액션이 하는 일은 둘이다 —
 * 첨부를 실제 오브젝트로 확정하기, 함수가 돌려준 코드를 문구로 옮기기.
 *
 * 30초 쿨다운은 두지 않는다(오너 결정 2026-09-15). 답장은 운영자 답변 하나당 1건이라
 * (`INQUIRY_USER_REPLY_WINDOW` · RPC 의 `too_many`) 연타할 창 자체가 없고, 접수 쪽
 * 창(`createInquiry`)에 답장 시각을 섞으면 "답장했더니 접수가 막히는" 경계만 생긴다.
 *
 * 문의 id 는 폼 필드가 아니라 bind 로 실어 받는다(필드로 두면 남의 문의 id 로 갈아
 * 끼운 POST 가 가능해진다 — RPC 가 거절하지만 시도 자체를 만들지 않는다).
 */

type ReplyInput = {
  content: string
  uploads: readonly PendingInquiryUpload[]
}

type ReplyInputResult = { ok: true; input: ReplyInput } | { ok: false; state: FormState }

/**
 * 폼에서 본문·첨부를 읽어 모양만 검사한다.
 *
 * 내용 상한은 RPC 와 같은 숫자다(`INQUIRY_USER_REPLY_MAX`). 여기서 걸러야 사용자가
 * 어느 칸을 고쳐야 하는지 알 수 있다 — 함수까지 가면 `invalid` 하나로 뭉뚱그려진다.
 */
function readReplyInput(formData: FormData): ReplyInputResult {
  const content = normalizeCRLF(readField(formData, 'content')).trim()

  if (content === '') {
    return { ok: false, state: { fieldErrors: { content: INQUIRY_USER_REPLY_REQUIRED_MESSAGE } } }
  }

  if (content.length > INQUIRY_USER_REPLY_MAX) {
    return { ok: false, state: { fieldErrors: { content: INQUIRY_USER_REPLY_TOO_LONG_MESSAGE } } }
  }

  /* 첨부는 본문에 실려 오지 않는다 — 브라우저가 버킷에 직접 올리고 폼은 경로만
     싣는다. `null` 은 "모양이 어긋남"이라 빈 목록과 구분해야 한다. */
  const uploads = readPendingUploads(formData)

  if (uploads === null) {
    return { ok: false, state: { fieldErrors: { attachments: UPLOAD_FORM_INVALID_MESSAGE } } }
  }

  const check = validateInquiryAttachments([], toUploadCandidates(uploads))

  if (!check.ok) {
    return { ok: false, state: { fieldErrors: { attachments: check.message } } }
  }

  return { ok: true, input: { content, uploads } }
}

/** RPC 실패 코드를 폼 상태로 옮긴다. 고칠 칸이 있는 코드만 필드 오류가 된다. */
function toFailureState(code: string): FormState {
  const message = userReplyErrorMessage(code)
  const field = INQUIRY_REPLY_ERROR_FIELD[code]

  return field === undefined ? { formError: message } : { fieldErrors: { [field]: message } }
}

/** jsonb 로 보낼 첨부. 읽기 전용 배열·도메인 타입을 평범한 객체 배열로 편다. */
function toAttachmentPayload(attachments: readonly InquiryAttachment[]) {
  return attachments.map((attachment) => ({
    name: attachment.name,
    path: attachment.path,
    size: attachment.size,
    mimeType: attachment.mimeType,
  }))
}

/**
 * RPC 호출 한 번.
 *
 * 함수 호출 자체가 실패한 경우(네트워크 · 권한)에는 코드가 없다. 알 수 없는 코드로
 * 내려 보내면 `userReplyErrorMessage` 가 일반 실패 문구로 받아 준다 — 실패를
 * 표현하는 길이 하나여야 호출부가 분기를 두 번 하지 않는다.
 */
async function callUserReplyRpc(
  supabase: TypedSupabaseClient,
  inquiryId: string,
  content: string,
  attachments: readonly InquiryAttachment[],
): Promise<UserReplyResult> {
  const { data, error } = await supabase.rpc('add_inquiry_user_reply', {
    p_inquiry_id: inquiryId,
    p_content: content,
    p_attachments: toAttachmentPayload(attachments),
  })

  return error === null ? parseUserReplyResult(data) : { ok: false, code: 'rpc_failed' }
}

type SendResult = { ok: true } | { ok: false; state: FormState }

/**
 * 첨부를 확정하고 RPC 를 부른다.
 *
 * 실패하면 **방금 확정한 것만** 되돌린다 — 답장이 남지 않았는데 오브젝트만 남으면
 * 어떤 행도 참조하지 않는 파일이 비공개 버킷에 쌓인다(접수 액션과 같은 패턴).
 */
async function sendReply(
  supabase: TypedSupabaseClient,
  userId: string,
  inquiryId: string,
  input: ReplyInput,
): Promise<SendResult> {
  const claimed = await claimFormUploads(userId, input.uploads)

  if (!claimed.ok) {
    return { ok: false, state: { fieldErrors: { attachments: claimed.message } } }
  }

  const result = await callUserReplyRpc(
    supabase,
    inquiryId,
    input.content,
    claimed.claim.attachments,
  )

  if (!result.ok) {
    await claimed.claim.rollback()

    return { ok: false, state: toFailureState(result.code) }
  }

  return { ok: true }
}

export async function replyToInquiry(
  inquiryId: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await getCurrentUser()

  if (user === null) {
    return { formError: INQUIRY_REPLY_LOGIN_MESSAGE }
  }

  if (!inquiryIdSchema.safeParse(inquiryId).success) {
    return { formError: INQUIRY_REPLY_NOT_FOUND_MESSAGE }
  }

  const parsed = readReplyInput(formData)

  if (!parsed.ok) {
    return parsed.state
  }

  const supabase = await createClient()
  const sent = await sendReply(supabase, user.id, inquiryId, parsed.input)

  if (!sent.ok) {
    return sent.state
  }

  const detailPath = `${MY_INQUIRIES_PATH}/${inquiryId}`

  /* 목록도 함께 민다 — 답장은 트리거가 문의의 `updated_at` 을 밀고, 목록·관리자
     탭이 그 값을 읽는다. */
  revalidatePath(MY_INQUIRIES_PATH)
  revalidatePath(detailPath)

  // redirect() 는 예외를 던지므로 성공 경로의 마지막에서 호출한다.
  redirect(`${detailPath}?${INQUIRY_REPLIED_PARAM}=1`)
}
