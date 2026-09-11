'use server'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import { revalidateInquiry } from '@/lib/actions/inquiry-shared'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { inquiryNoteDeleteSchema, inquiryNoteSchema } from '@/lib/validation/inquiry-assignment'

/**
 * 운영자 전용 내부 메모.
 *
 * 사용자에게는 **어떤 경로로도** 보이지 않는다 — 별도 테이블(`inquiry_notes`)이고
 * 정책은 관리자 전용이다(`20260911000300`). 사용자 사이트는 이 테이블을 읽지 않는다.
 */

const NOTE_NOT_FOUND_MESSAGE = '메모를 찾을 수 없습니다. 목록을 새로고침해 주세요.'

export async function createInquiryNoteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const parsed = inquiryNoteSchema.safeParse({
    inquiryId: readField(formData, 'inquiryId'),
    body: readField(formData, 'body'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { inquiryId, body } = parsed.data
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inquiry_notes')
    .insert({
      inquiry_id: inquiryId,
      author_id: actor.id,
      /* 작성 시점의 닉네임을 함께 박는다. 나중에 계정이 사라져도 "누구의 판단인지"는
         남아야 한다(author_id 는 on delete set null 이다). */
      author_nickname_snapshot: actor.nickname,
      body,
    })
    .select('id')
    .single()

  if (error !== null) {
    return actionFailure(
      'inquiries',
      '메모를 남기지 못했습니다. 작성한 내용은 그대로 있으니 잠시 후 다시 저장해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_note.create',
    targetTable: 'inquiry_notes',
    targetId: data.id,
    // 본문은 남기지 않는다 — 메모를 지워도 감사 로그에 사본이 남으면 지운 뜻이 사라진다.
    after: { inquiry_id: inquiryId, length: body.length },
  })

  revalidateInquiry(inquiryId)

  return { message: '내부 메모를 남겼습니다.' }
}

/**
 * 내 메모 삭제.
 *
 * RLS(`inquiry_notes_delete_own`)가 같은 규칙을 강제한다. 여기서 다시 읽는 이유는
 * 정책이 막았을 때 "0건 삭제"가 조용한 성공으로 보이기 때문이다 — 운영자에게는
 * 지워지지 않은 이유를 말해 줘야 한다.
 */
export async function deleteInquiryNoteAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const parsed = inquiryNoteDeleteSchema.safeParse({
    noteId: readField(formData, 'noteId'),
    inquiryId: readField(formData, 'inquiryId'),
  })

  if (!parsed.success) {
    return { formError: NOTE_NOT_FOUND_MESSAGE }
  }

  const { noteId, inquiryId } = parsed.data
  const supabase = await createClient()
  const { data: note } = await supabase
    .from('inquiry_notes')
    .select('author_id')
    .eq('id', noteId)
    .maybeSingle()

  if (note === null) {
    return { formError: NOTE_NOT_FOUND_MESSAGE }
  }

  if (note.author_id !== actor.id) {
    return { formError: '내가 남긴 메모만 지울 수 있습니다.' }
  }

  const { error } = await supabase.from('inquiry_notes').delete().eq('id', noteId)

  if (error !== null) {
    return actionFailure(
      'inquiries',
      '메모를 지우지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_note.delete',
    targetTable: 'inquiry_notes',
    targetId: noteId,
    before: { inquiry_id: inquiryId },
  })

  revalidateInquiry(inquiryId)

  return { message: '내부 메모를 지웠습니다.' }
}
