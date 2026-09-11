'use server'

import { actionFailure } from '@/lib/actions/action-failure'
import { readField, toFieldErrors, type FormState } from '@/lib/actions/form-state'
import {
  TEMPLATE_AUDIT_TABLE,
  TEMPLATE_NOT_FOUND,
  readTemplateInput,
  revalidateInquiryReplyTemplates,
  toTemplateFieldError,
} from '@/lib/actions/inquiry-reply-template-shared'
import { writeAuditLog } from '@/lib/audit'
import { requirePermission } from '@/lib/auth/require-admin'
import { getNextInquiryReplyTemplateSortOrder } from '@/lib/data/inquiry-reply-templates'
import { createClient } from '@/lib/supabase/server'
import {
  inquiryReplyTemplateReorderSchema,
  inquiryReplyTemplateSchema,
  toCategoryId,
} from '@/lib/validation/inquiry-reply-templates'

/**
 * 답변 템플릿 CRUD · 활성 토글 · 정렬 저장.
 *
 * 모든 액션이 스스로 `requirePermission('inquiries', 'write')` 을 부르고(직접 POST 방어),
 * 상태를 바꾼 뒤 감사 로그를 남긴다. 쓰기는 세션 클라이언트로만 한다 —
 * `inquiry_reply_templates_admin_all` 정책이 다시 검사하게 두어야 권한 버그가 조용히
 * 통과하지 않는다. 사용자 사이트는 이 테이블을 읽지 않으므로(관리자 전용)
 * `revalidateClient()` 는 부르지 않는다 — 태울 태그가 없다.
 */

export async function createInquiryReplyTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const parsed = inquiryReplyTemplateSchema.safeParse(readTemplateInput(formData))

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { name, body, isActive } = parsed.data
  const categoryId = toCategoryId(parsed.data.categoryId)
  const supabase = await createClient()
  // 새 템플릿은 그 묶음의 맨 뒤에 붙인다. 중간에 끼우면 기존 순서가 통째로 밀린다.
  const sortOrder = await getNextInquiryReplyTemplateSortOrder(categoryId)

  const { data, error } = await supabase
    .from('inquiry_reply_templates')
    .insert({
      category_id: categoryId,
      name,
      body,
      sort_order: sortOrder,
      is_active: isActive,
      created_by: actor.id,
      updated_by: actor.id,
    })
    .select('id')
    .single()

  if (error !== null) {
    const fieldErrors = toTemplateFieldError(error.code)

    if (fieldErrors !== null) {
      return { fieldErrors }
    }

    return actionFailure(
      'inquiry-reply-templates',
      '템플릿을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_reply_template.create',
    targetTable: TEMPLATE_AUDIT_TABLE,
    targetId: data.id,
    after: { category_id: categoryId, name, body, is_active: isActive, sort_order: sortOrder },
  })

  revalidateInquiryReplyTemplates()

  return { message: '템플릿을 등록했습니다.' }
}

export async function updateInquiryReplyTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const templateId = readField(formData, 'templateId')
  const parsed = inquiryReplyTemplateSchema.safeParse(readTemplateInput(formData))

  if (templateId === '') {
    return { formError: TEMPLATE_NOT_FOUND }
  }

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { name, body, isActive } = parsed.data
  const categoryId = toCategoryId(parsed.data.categoryId)
  const supabase = await createClient()
  const { data: before } = await supabase
    .from('inquiry_reply_templates')
    .select('category_id, name, body, sort_order, is_active')
    .eq('id', templateId)
    .maybeSingle()

  if (before === null) {
    return { formError: TEMPLATE_NOT_FOUND }
  }

  /* 카테고리를 옮기면 순서 값은 옮겨 간 묶음의 맨 뒤로 다시 잡는다. 그대로 두면
     새 묶음에서 같은 순번이 겹쳐 화면 순서가 만든 사람도 모르게 갈린다. */
  const sortOrder =
    before.category_id === categoryId
      ? before.sort_order
      : await getNextInquiryReplyTemplateSortOrder(categoryId)

  const { error } = await supabase
    .from('inquiry_reply_templates')
    .update({
      category_id: categoryId,
      name,
      body,
      sort_order: sortOrder,
      is_active: isActive,
      updated_by: actor.id,
    })
    .eq('id', templateId)

  if (error !== null) {
    const fieldErrors = toTemplateFieldError(error.code)

    if (fieldErrors !== null) {
      return { fieldErrors }
    }

    return actionFailure(
      'inquiry-reply-templates',
      '템플릿을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_reply_template.update',
    targetTable: TEMPLATE_AUDIT_TABLE,
    targetId: templateId,
    before,
    after: { category_id: categoryId, name, body, sort_order: sortOrder, is_active: isActive },
  })

  revalidateInquiryReplyTemplates()

  return { message: '템플릿을 수정했습니다.' }
}

/* 템플릿은 답변을 만들 때 **복사**되는 문안이라, 지워도 이미 등록된 답변은 그대로
   남는다 — 카테고리와 달리 사용 건수로 삭제를 막지 않는다. */
export async function deleteInquiryReplyTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const templateId = readField(formData, 'templateId')

  if (templateId === '') {
    return { formError: TEMPLATE_NOT_FOUND }
  }

  const supabase = await createClient()
  const { data: before } = await supabase
    .from('inquiry_reply_templates')
    .select('category_id, name, body, sort_order, is_active')
    .eq('id', templateId)
    .maybeSingle()

  if (before === null) {
    return { formError: TEMPLATE_NOT_FOUND }
  }

  const { error } = await supabase.from('inquiry_reply_templates').delete().eq('id', templateId)

  if (error !== null) {
    return actionFailure(
      'inquiry-reply-templates',
      '템플릿을 삭제하지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_reply_template.delete',
    targetTable: TEMPLATE_AUDIT_TABLE,
    targetId: templateId,
    before,
  })

  revalidateInquiryReplyTemplates()

  return { message: '템플릿을 삭제했습니다.' }
}

/** 활성/비활성 토글. 비활성 템플릿은 답변 화면의 선택 상자에서 즉시 사라진다. */
export async function toggleInquiryReplyTemplateAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const templateId = readField(formData, 'templateId')
  const nextActive = readField(formData, 'isActive') === 'true'

  if (templateId === '') {
    return { formError: TEMPLATE_NOT_FOUND }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('inquiry_reply_templates')
    .update({ is_active: nextActive, updated_by: actor.id })
    .eq('id', templateId)

  if (error !== null) {
    return actionFailure(
      'inquiry-reply-templates',
      '템플릿 상태를 바꾸지 못했습니다. 잠시 후 다시 시도해 주세요.',
      error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_reply_template.update',
    targetTable: TEMPLATE_AUDIT_TABLE,
    targetId: templateId,
    before: { is_active: !nextActive },
    after: { is_active: nextActive },
  })

  revalidateInquiryReplyTemplates()

  return { message: nextActive ? '템플릿을 켰습니다.' : '템플릿을 껐습니다.' }
}

/* 순서 저장 — 한 묶음(공통 또는 카테고리 하나)이 보여 준 순서를 그대로 0..n-1 로 다시
   쓴다. 두 행의 값만 맞바꾸면 기존 데이터에 중복·구멍이 있을 때 결과가 화면과 달라진다. */
export async function reorderInquiryReplyTemplatesAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requirePermission('inquiries', 'write')
  const parsed = inquiryReplyTemplateReorderSchema.safeParse({
    ids: readField(formData, 'ids').split(',').filter(Boolean),
  })

  if (!parsed.success) {
    return { formError: '정렬 정보를 읽지 못했습니다.' }
  }

  const { ids } = parsed.data
  const supabase = await createClient()

  const results = await Promise.all(
    ids.map((id, index) =>
      supabase
        .from('inquiry_reply_templates')
        .update({ sort_order: index, updated_by: actor.id })
        .eq('id', id),
    ),
  )

  const failed = results.find((result) => result.error !== null)

  if (failed?.error != null) {
    /* 행마다 UPDATE 를 던지므로 앞쪽 몇 건은 이미 저장됐을 수 있다. */
    return actionFailure(
      'inquiry-reply-templates',
      '순서를 저장하지 못했습니다. 일부만 반영됐을 수 있으니 새로고침해 순서를 확인해 주세요.',
      failed.error,
    )
  }

  await writeAuditLog(actor.id, {
    action: 'inquiry_reply_template.reorder',
    targetTable: TEMPLATE_AUDIT_TABLE,
    // 대상이 여러 행이라 targetId 는 비운다. 무엇이 어떤 순서가 됐는지는 after 에 남는다.
    after: { ids: [...ids] },
  })

  revalidateInquiryReplyTemplates()

  return { message: '순서를 저장했습니다.' }
}
