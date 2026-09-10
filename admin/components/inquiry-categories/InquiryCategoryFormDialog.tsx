'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button, Dialog, FormBanner, Input, Textarea, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import {
  createInquiryCategoryAction,
  updateInquiryCategoryAction,
} from '@/lib/actions/inquiry-category-actions'
import {
  INQUIRY_CATEGORY_DESCRIPTION_MAX,
  INQUIRY_CATEGORY_LABEL_MAX,
  INQUIRY_CATEGORY_PREFILL_MAX,
} from '@/lib/validation/inquiry-categories'

import type { FormState } from '@/lib/actions/form-state'
import type { AdminInquiryCategory } from '@/lib/data/inquiry-categories'

/**
 * 카테고리 등록 · 수정 다이얼로그.
 *
 * 프리필은 **평문**이다. 사용자 폼의 textarea 에 그대로 들어가므로 마크다운은 해석되지
 * 않고 줄바꿈만 살아남는다. 미리보기를 같은 방식(`whitespace-pre-line`)으로 그려서
 * 저장 전에 사용자가 볼 모습을 확인하게 한다.
 *
 * 이름을 바꾸면 그 이름으로 접수된 과거 문의의 분류도 함께 바뀐다 — 되돌리기 어려운
 * 조작이라 그 사실을 폼 안에 적어 둔다(실제 반영 건수는 저장 뒤 토스트에 나온다).
 */
export function InquiryCategoryFormDialog({
  category,
  triggerLabel,
  triggerVariant = 'primary',
  triggerSize,
}: {
  /** 없으면 등록, 있으면 수정. */
  category?: AdminInquiryCategory
  triggerLabel: string
  triggerVariant?: 'primary' | 'secondary'
  triggerSize?: 'sm' | 'md'
}) {
  const [isOpen, setOpen] = useState(false)
  const [prefill, setPrefill] = useState(category?.prefill ?? '')
  const { showToast } = useToast()
  const isEdit = category !== undefined

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = isEdit
        ? await updateInquiryCategoryAction(prevState, formData)
        : await createInquiryCategoryAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)

        if (!isEdit) {
          setPrefill('')
        }
      }

      return result
    },
    [isEdit, showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

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
        title={isEdit ? '카테고리 수정' : '카테고리 등록'}
        description="사용자 사이트 1:1 문의 폼의 카테고리 선택과 문의 내용 프리필에 그대로 쓰입니다."
      >
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {isEdit && <input type="hidden" name="categoryId" value={category.id} />}

          <FormBanner message={state.formError} />

          <Input
            label="이름"
            name="label"
            required
            maxLength={INQUIRY_CATEGORY_LABEL_MAX}
            defaultValue={category?.label ?? ''}
            hint={
              isEdit
                ? '문의 폼의 카테고리 선택에 그대로 보입니다. 이름을 바꾸면 이 분류로 접수된 기존 문의도 함께 새 이름으로 옮겨집니다.'
                : '문의 폼의 카테고리 선택에 그대로 보입니다.'
            }
            error={state.fieldErrors?.label}
          />

          <Input
            label="설명"
            name="description"
            maxLength={INQUIRY_CATEGORY_DESCRIPTION_MAX}
            defaultValue={category?.description ?? ''}
            hint="카테고리 선택 아래 한 줄로 보입니다. 비워 두면 아무것도 나오지 않습니다."
            error={state.fieldErrors?.description}
          />

          <Textarea
            label="프리필(문의 내용 양식)"
            name="prefill"
            rows={8}
            maxLength={INQUIRY_CATEGORY_PREFILL_MAX}
            value={prefill}
            onChange={(event) => setPrefill(event.target.value)}
            hint="사용자가 이 카테고리를 고르면 문의 내용 칸에 그대로 채워집니다. 줄바꿈은 그대로 살아납니다."
            error={state.fieldErrors?.prefill}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">사용자 화면 미리보기</span>
            <p className="border-line bg-page text-ink rounded-panel border px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-line">
              {prefill === '' ? '프리필을 입력하면 사용자 화면 모습이 보입니다.' : prefill}
            </p>
          </div>

          <label className="text-ink flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="isActive"
              defaultChecked={category?.isActive ?? true}
              className="accent-accent size-4"
            />
            사용자 폼에 노출
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
