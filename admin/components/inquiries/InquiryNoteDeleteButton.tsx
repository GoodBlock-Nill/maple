'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button, Dialog, FormBanner, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { deleteInquiryNoteAction } from '@/lib/actions/inquiry-note-actions'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 내부 메모 삭제 + 확인 다이얼로그.
 *
 * 메모는 판단의 기록이라 되돌릴 수 없다(감사 로그에는 "지웠다"만 남고 본문은 남기지
 * 않는다 — 지운 뜻이 사라지지 않게 하려는 것이다). 그래서 한 단계를 둔다.
 *
 * 버튼 자체가 **내 메모에만** 그려지고, 액션과 RLS 도 같은 규칙으로 다시 검사한다.
 */
export function InquiryNoteDeleteButton({
  noteId,
  inquiryId,
}: {
  noteId: string
  inquiryId: string
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await deleteInquiryNoteAction(prevState, formData)

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
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        삭제
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="내부 메모 삭제"
        description="이 메모를 지웁니다. 문의 내용과 답변은 그대로이고, 지운 메모는 되살릴 수 없습니다."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="noteId" value={noteId} />
          <input type="hidden" name="inquiryId" value={inquiryId} />

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
