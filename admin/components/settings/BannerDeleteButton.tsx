'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { deleteHeroBannerAction } from '@/lib/actions/settings-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 배너 삭제 + 확인 다이얼로그.
 *
 * 목록의 다른 조작(↑ ↓ · 노출 전환)은 전부 되돌릴 수 있어 한 번에 실행하지만,
 * 삭제만은 되돌릴 수 없다. 같은 줄에 나란히 놓인 버튼이라 오조작이 나기 쉬워
 * 한 단계를 세우고, "잠깐 내리려는 것"이라면 숨기기가 맞다는 것도 함께 알린다.
 */
export function BannerDeleteButton({ id, title }: { id: string; title: string }) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await deleteHeroBannerAction(prevState, formData)

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
        title="배너 삭제"
        description={`"${title}" 배너를 삭제합니다. 되돌릴 수 없습니다. 잠시 내리려는 것이라면 숨기기를 눌러 주세요.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />

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
