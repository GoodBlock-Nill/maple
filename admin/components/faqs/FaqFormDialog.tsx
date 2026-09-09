'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button, Dialog, FormBanner, Input, Textarea, useToast } from '@/components/ui'
import { createFaqAction, updateFaqAction } from '@/lib/actions/faqs-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import {
  FAQ_ANSWER_MAX_LENGTH,
  FAQ_CATEGORIES,
  FAQ_QUESTION_MAX_LENGTH,
} from '@/lib/validation/faqs'

import type { FormState } from '@/lib/actions/form-state'
import type { FaqItem } from '@/lib/data/faqs'
import type { FaqCategory } from '@/lib/validation/faqs'

/**
 * FAQ 등록 · 수정 다이얼로그.
 *
 * 답변은 평문이다. 사용자 사이트의 아코디언이 답변을 한 문단(`<p>`)으로 그리므로
 * 마크다운은 해석되지 않고 **줄바꿈도 표시되지 않는다**. 미리보기를 같은 방식으로
 * 그려서, 등록 전에 실제 모습을 확인하게 한다.
 */
export function FaqFormDialog({
  faq,
  defaultCategory,
  triggerLabel,
  triggerVariant = 'primary',
  triggerSize,
}: {
  /** 없으면 등록, 있으면 수정. */
  faq?: FaqItem
  defaultCategory?: FaqCategory
  triggerLabel: string
  triggerVariant?: 'primary' | 'secondary'
  triggerSize?: 'sm' | 'md'
}) {
  const [isOpen, setOpen] = useState(false)
  const [answer, setAnswer] = useState(faq?.answer ?? '')
  const { showToast } = useToast()
  const isEdit = faq !== undefined

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = isEdit
        ? await updateFaqAction(prevState, formData)
        : await createFaqAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)

        if (!isEdit) {
          setAnswer('')
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
        title={isEdit ? 'FAQ 수정' : 'FAQ 등록'}
        description="사용자 사이트의 '자주 묻는 질문'에 그대로 표시됩니다."
      >
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          {isEdit && <input type="hidden" name="faqId" value={faq.id} />}

          <FormBanner message={state.formError} />

          <label className="flex flex-col gap-1.5">
            <span className="text-ink text-[13px] font-semibold">카테고리</span>
            <select
              name="category"
              defaultValue={faq?.category ?? defaultCategory ?? FAQ_CATEGORIES[0]?.value}
              className="rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-10 border px-3 text-[14px] focus:outline-2"
            >
              {FAQ_CATEGORIES.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </label>

          <Input
            label="질문"
            name="question"
            required
            maxLength={FAQ_QUESTION_MAX_LENGTH}
            defaultValue={faq?.question ?? ''}
            hint="사용자 사이트 FAQ 아코디언의 접힌 줄에 그대로 보입니다. PC 약 28자 · 폰 약 13자마다 줄이 바뀌므로 한 줄짜리 질문이 읽기 좋습니다."
            error={state.fieldErrors?.question}
          />

          <Textarea
            label="답변"
            name="answer"
            rows={6}
            required
            maxLength={FAQ_ANSWER_MAX_LENGTH}
            value={answer}
            onChange={(event) => setAnswer(event.target.value)}
            hint="사용자 화면은 한 문단으로 이어 붙여 보여 줍니다(줄바꿈 표시 없음)."
            error={state.fieldErrors?.answer}
          />

          <div className="flex flex-col gap-1.5">
            <span className="text-muted text-[12px] font-semibold">미리보기</span>
            <p className="border-line bg-page text-ink rounded-panel border px-3 py-2.5 text-[13px] leading-relaxed">
              {answer === '' ? '답변을 입력하면 사용자 화면 모습이 보입니다.' : answer}
            </p>
          </div>

          <label className="text-ink flex items-center gap-2 text-[13px]">
            <input
              type="checkbox"
              name="isPublished"
              defaultChecked={faq?.isPublished ?? true}
              className="accent-accent size-4"
            />
            사용자 사이트에 발행
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
