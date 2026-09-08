'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { deleteGachaItemAction } from '@/lib/actions/gacha-actions'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 삭제 버튼 + 확인 다이얼로그.
 *
 * 확률형 아이템은 공시 자료라 되돌릴 방법이 없다(소프트 삭제가 아니다).
 * 한 단계를 두어 목록에서의 오조작을 막는다.
 */
export function DeleteGachaButton({ id, name }: { id: string; name: string }) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  // 성공 처리는 액션 안에서 끝낸다(components/admins/InviteAdminDialog 주석 참고).
  const runDelete = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await deleteGachaItemAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(runDelete, EMPTY_FORM_STATE)

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        삭제
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="아이템 삭제"
        description={`${name} 을(를) 삭제합니다. 되돌릴 수 없습니다.`}
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
