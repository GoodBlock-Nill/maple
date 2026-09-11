'use client'

import { useActionState, useCallback, useState } from 'react'

import { InquiryReplyTemplateBodyField } from '@/components/inquiry-reply-templates/InquiryReplyTemplateBodyField'
import { Button, Dialog, FormBanner, Input, Select, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import {
  createInquiryReplyTemplateAction,
  updateInquiryReplyTemplateAction,
} from '@/lib/actions/inquiry-reply-template-actions'
import {
  COMMON_CATEGORY_LABEL,
  COMMON_CATEGORY_VALUE,
  INQUIRY_REPLY_TEMPLATE_NAME_MAX,
} from '@/lib/validation/inquiry-reply-templates'

import type { FormState } from '@/lib/actions/form-state'
import type {
  AdminInquiryReplyTemplate,
  InquiryReplyTemplateCategory,
} from '@/lib/data/inquiry-reply-templates'

/**
 * 템플릿 등록 · 수정 다이얼로그.
 *
 * 카테고리 셀렉트의 첫 항목이 **공통**이다(값은 빈 문자열 = `category_id IS NULL`).
 * 공통 템플릿은 어느 문의에서나 보이므로 인사·접수 확인처럼 분류를 타지 않는 문안을 둔다.
 *
 * 비활성 카테고리도 고를 수 있게 남겨 둔다 — 이미 그 카테고리에 붙어 있는 템플릿을
 * 고치려면 셀렉트에 그 항목이 있어야 하고, 없으면 저장할 때 엉뚱한 곳으로 옮겨진다.
 */
export function InquiryReplyTemplateFormDialog({
  template,
  categories,
  defaultCategoryId,
  triggerLabel,
  triggerVariant = 'primary',
  triggerSize,
}: {
  /** 없으면 등록, 있으면 수정. */
  template?: AdminInquiryReplyTemplate
  categories: readonly InquiryReplyTemplateCategory[]
  /** 등록 폼이 미리 고를 카테고리. 묶음 머리글의 '템플릿 추가' 가 자기 묶음을 넘긴다. */
  defaultCategoryId?: string | null
  triggerLabel: string
  triggerVariant?: 'primary' | 'secondary'
  triggerSize?: 'sm' | 'md'
}) {
  const [isOpen, setOpen] = useState(false)
  const [body, setBody] = useState(template?.body ?? '')
  const { showToast } = useToast()
  const isEdit = template !== undefined

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = isEdit
        ? await updateInquiryReplyTemplateAction(prevState, formData)
        : await createInquiryReplyTemplateAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)

        if (!isEdit) {
          setBody('')
        }
      }

      return result
    },
    [isEdit, showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  const options = [
    { value: COMMON_CATEGORY_VALUE, label: COMMON_CATEGORY_LABEL },
    ...categories.map((category) => ({
      value: category.id,
      label: category.isActive ? category.label : `${category.label} (숨김)`,
    })),
  ]

  const selectedCategory =
    (isEdit ? template.categoryId : defaultCategoryId) ?? COMMON_CATEGORY_VALUE

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize ?? (isEdit ? 'sm' : 'md')}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title={isEdit ? '답변 템플릿 수정' : '답변 템플릿 등록'}
        description="문의 상세의 답변 칸에 '템플릿 불러오기' 로 채워 넣는 문안입니다."
      >
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {isEdit && <input type="hidden" name="templateId" value={template.id} />}

          <FormBanner message={state.formError} />

          <Select
            label="카테고리"
            name="categoryId"
            options={options}
            defaultValue={selectedCategory}
            hint="공통으로 두면 모든 문의에서 보입니다. 카테고리를 고르면 그 분류의 문의에서만 보입니다."
            error={state.fieldErrors?.categoryId}
          />

          <Input
            label="템플릿 이름"
            name="name"
            required
            maxLength={INQUIRY_REPLY_TEMPLATE_NAME_MAX}
            defaultValue={template?.name ?? ''}
            hint="답변 화면의 선택 상자에 보입니다. 사용자에게는 노출되지 않습니다."
            error={state.fieldErrors?.name}
          />

          <InquiryReplyTemplateBodyField
            value={body}
            onChange={setBody}
            error={state.fieldErrors?.body}
          />

          <label className="text-ink flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={template?.isActive ?? true}
              className="accent-accent size-4"
            />
            답변 화면에서 사용
          </label>

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '저장 중…' : isEdit ? '수정' : '등록'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
