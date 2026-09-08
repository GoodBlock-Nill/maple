'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button, Dialog, FormBanner, useToast } from '@/components/ui'
import { deleteFaqAction } from '@/lib/actions/faqs-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

/**
 * FAQ 삭제 + 확인 다이얼로그.
 *
 * 되돌릴 수 없는 조작이라 한 단계를 둔다. "잠깐 내리고 싶다"면 삭제가 아니라
 * 발행 토글이 맞다는 것도 문구로 알려 준다.
 */
export function FaqDeleteButton({ faqId, question }: { faqId: string; question: string }) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await deleteFaqAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        삭제
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="FAQ 삭제"
        description="되돌릴 수 없습니다. 잠시 숨기려는 것이라면 발행을 해제하세요."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="faqId" value={faqId} />

          <p className="text-ink text-[13px]">{question}</p>

          <FormBanner message={state.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button variant="danger" type="submit" disabled={isPending}>
              {isPending ? '삭제 중…' : '삭제'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
