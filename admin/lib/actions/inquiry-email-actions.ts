'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { EMAIL_NOT_CONFIGURED_MESSAGE, sendInquiryReplyEmail } from '@/lib/email/send-inquiry-reply'
import { createClient } from '@/lib/supabase/server'

/**
 * 이메일 문의 전용 액션 — 답신 다시 보내기.
 *
 * 답변 등록 자체는 1:1 문의와 같은 액션(`inquiries-actions.ts`)이 처리한다. 여기에는
 * 이메일에만 있는 조작만 둔다(파일 300줄 상한 · 관심사 분리).
 *
 * 발송이 실패해도 답신 행은 그대로 남는다. 그래서 운영자가 스레드에서 한 번 더
 * 누르는 길이 필요하고, 그 조작 역시 감사 로그에 남는다(`inquiry.email.resend`).
 */

const LIST_PATH = '/inquiries'

/** '다시 보낼 수 있는' 상태. null 은 발송을 시도한 적이 없는 행이다. */
const RESENDABLE_STATUSES: readonly (string | null)[] = [null, 'queued', 'failed']

const resendSchema = z.object({
  replyId: z.uuid('답신을 찾을 수 없습니다.'),
})

/**
 * 저장된 답신을 다시 발송한다.
 *
 * 화면에서 실패한 답신에만 버튼을 세우지만, 액션은 UI 를 거치지 않는 직접 POST 로도
 * 불릴 수 있으므로 방향·출처·발송 상태를 여기서 모두 다시 확인한다. 특히 이미 보낸
 * 답신을 막지 않으면 사용자가 같은 메일을 두 번 받는다.
 */
export async function resendInquiryEmailAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const parsed = resendSchema.safeParse({ replyId: readField(formData, 'replyId') })

  if (!parsed.success) {
    return { formError: Object.values(toFieldErrors(parsed.error))[0] ?? '잘못된 요청입니다.' }
  }

  const { replyId } = parsed.data
  const supabase = await createClient()
  const { data: reply } = await supabase
    .from('inquiry_replies')
    .select('id, inquiry_id, direction, delivery_status')
    .eq('id', replyId)
    .maybeSingle()

  if (reply === null) {
    return { formError: '답신을 찾을 수 없습니다.' }
  }

  if (reply.direction !== 'outbound') {
    return { formError: '받은 메일은 다시 보낼 수 없습니다.' }
  }

  if (!RESENDABLE_STATUSES.includes(reply.delivery_status)) {
    return { formError: '이미 발송된 답신입니다.' }
  }

  const { data: inquiry } = await supabase
    .from('inquiries')
    .select('source')
    .eq('id', reply.inquiry_id)
    .maybeSingle()

  if (inquiry === null || inquiry.source !== 'email') {
    return { formError: '이메일 문의가 아닙니다. 답신을 메일로 보낼 수 없습니다.' }
  }

  const result = await sendInquiryReplyEmail(replyId)

  await writeAuditLog(actor.id, {
    action: 'inquiry.email.resend',
    targetTable: 'inquiry_replies',
    targetId: replyId,
    after: { result: result.ok ? result.status : result.reason },
  })

  revalidatePath(`${LIST_PATH}/${reply.inquiry_id}`)

  if (result.ok) {
    return { message: '답신 메일을 다시 보냈습니다.' }
  }

  if (result.reason === 'not_configured') {
    // 운영 설정이 아직 없는 정상적인 상태다. 개발자 로그를 남길 실패가 아니다.
    return { formError: EMAIL_NOT_CONFIGURED_MESSAGE }
  }

  return actionFailure(
    'inquiries',
    '메일을 다시 보내지 못했습니다. 잠시 후 다시 시도해 주세요.',
    result.detail,
  )
}
