'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { deleteAdminRoleAction } from '@/lib/actions/admin-role-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 역할 삭제.
 *
 * 시스템 역할과 "쓰는 사람이 있는 역할"은 버튼 단계에서 막고 이유를 그 자리에
 * 적는다. 눌러 보고 나서야 거절 사유를 알려 주면 운영자는 무엇을 먼저 해야 하는지
 * 알 수 없다. 서버 액션도 같은 두 조건을 다시 검사한다.
 */
export function DeleteRoleButton({
  roleId,
  name,
  isSystem,
  memberCount,
}: {
  roleId: string
  name: string
  isSystem: boolean
  memberCount: number
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await deleteAdminRoleAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  if (isSystem) {
    return <span className="text-muted text-[12px]">시스템 역할</span>
  }

  if (memberCount > 0) {
    return <span className="text-muted text-[12px]">사용 중 {memberCount}명</span>
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        삭제
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="역할 삭제"
        description={`${name} 역할을 삭제합니다. 이 역할을 쓰는 관리자는 없습니다.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="roleId" value={roleId} />

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
