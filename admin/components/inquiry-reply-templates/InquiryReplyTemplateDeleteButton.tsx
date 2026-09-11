'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button, Dialog, FormBanner, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { deleteInquiryReplyTemplateAction } from '@/lib/actions/inquiry-reply-template-actions'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 템플릿 삭제 + 확인 다이얼로그.
 *
 * 템플릿은 답변을 만들 때 **복사**되는 문안이라, 지워도 이미 등록된 답변은 그대로
 * 남는다. 확인 다이얼로그가 그 사실을 적는 이유는 "삭제"라는 말만 보면 운영자가
 * 지난 답변까지 사라진다고 오해하기 때문이다.
 */
export function InquiryReplyTemplateDeleteButton({
  templateId,
  name,
}: {
  templateId: string
  name: string
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await deleteInquiryReplyTemplateAction(prevState, formData)

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
        title="답변 템플릿 삭제"
        description="되돌릴 수 없습니다. 이미 등록된 답변은 그대로 남고, 앞으로 이 문안을 불러올 수 없게 됩니다. 잠시 쓰지 않으려는 것이라면 삭제 대신 '끄기'를 쓰세요."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="templateId" value={templateId} />

          <p className="text-ink text-[13px]">{name}</p>

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
