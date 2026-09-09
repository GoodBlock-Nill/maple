'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { forceWithdrawMemberAction } from '@/lib/actions/member-lifecycle-actions'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 강제 탈퇴 — 관리자가 회원을 탈퇴 상태로 전환한다.
 *
 * **정지와 다른 조치다.** 정지는 쓰기만 막지만 강제 탈퇴는 보존 기간(90일) 시계를
 * 돌리기 시작한다. 그래서 확인 다이얼로그를 따로 세우고, 설명에 세 가지를 모두
 * 적는다 — 90일 뒤 파기된다는 것, 그 안에 본인이 로그인하면 복구된다는 것,
 * 진행 중인 이용 제한은 유지된다는 것.
 */
export function MemberForceWithdrawDialog({
  memberId,
  nickname,
}: {
  memberId: string
  nickname: string
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (state: FormState, formData: FormData): Promise<FormState> => {
      const result = await forceWithdrawMemberAction(state, formData)

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
        강제 탈퇴
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="강제 탈퇴"
        description={`${nickname} 회원을 탈퇴 상태로 전환합니다. 90일 후 개인정보가 파기되며, 그 안에 본인이 다시 로그인하면 복구됩니다. 진행 중인 이용 제한은 유지됩니다.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="memberId" value={memberId} />

          <FormBanner message={state.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" variant="danger" disabled={isPending}>
              {isPending ? '탈퇴 처리 중…' : '탈퇴 처리'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
