'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { deleteAdminAction } from '@/lib/actions/admin-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 관리자 삭제 버튼 + 확인 다이얼로그.
 *
 * 다이얼로그 문구가 **실제로 일어나는 일**을 그대로 적는다 — 계정 행은 남고,
 * 로그인만 막히며, 작성 이력은 그대로다. "삭제"라는 단어만 보면 운영자는 글까지
 * 사라진다고 오해한다.
 *
 * 자기 자신은 서버 액션도 거부하지만 버튼 단계에서 미리 이유를 알려 준다.
 */
export function DeleteAdminButton({
  adminId,
  nickname,
  isSelf,
}: {
  adminId: string
  nickname: string
  isSelf: boolean
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await deleteAdminAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  if (isSelf) {
    return (
      <span className="text-muted text-[12px]" title="자기 자신은 삭제할 수 없습니다.">
        본인
      </span>
    )
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        삭제
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="관리자 삭제"
        description={`${nickname} 관리자를 삭제합니다. 관리자 콘솔에 로그인할 수 없게 되며 작성 이력은 남습니다.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="adminId" value={adminId} />

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
