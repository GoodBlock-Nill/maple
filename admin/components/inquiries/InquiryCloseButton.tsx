'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button, Dialog, FormBanner, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { updateInquiryStatusAction } from '@/lib/actions/inquiries-actions'

import type { FormState } from '@/lib/actions/form-state'

/**
 * "종료" 버튼 + 확인 다이얼로그.
 *
 * 상태 select 로도 종료할 수 있지만, 종료는 사용자 화면에서 스레드가 닫히는 조작이라
 * 한 단계를 둔다. 되돌리려면 '처리 중'으로만 열 수 있다(상태 전이 표).
 */
export function InquiryCloseButton({ inquiryId }: { inquiryId: string }) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await updateInquiryStatusAction(prevState, formData)

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
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        종료
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="문의 종료"
        description="사용자 화면의 상태가 '종료'로 바뀝니다. 필요하면 나중에 '처리 중'으로 되돌릴 수 있습니다."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="inquiryId" value={inquiryId} />
          <input type="hidden" name="status" value="closed" />

          <FormBanner message={state.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '처리 중…' : '종료'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
