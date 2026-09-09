'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { revokeAdminAction } from '@/lib/actions/admin-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 권한 회수 버튼 + 확인 다이얼로그.
 *
 * 되돌리기 쉬운 조작이지만(다시 초대하면 된다) 잘못 누르면 그 사람이 곧바로
 * 화면 밖으로 밀려나므로 한 단계를 둔다. 자기 자신은 서버 액션도 거부하지만
 * 버튼 단계에서 미리 비활성화해 이유를 알려 준다.
 */
export function RevokeAdminButton({
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

  // 성공 처리는 액션 안에서 끝낸다(성공 메시지를 컴포넌트에서 다루면 리다이렉트와 경합한다).
  const runRevoke = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await revokeAdminAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(runRevoke, EMPTY_FORM_STATE)

  if (isSelf) {
    return (
      <span className="text-muted text-[12px]" title="자기 자신의 권한은 회수할 수 없습니다.">
        본인
      </span>
    )
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        권한 회수
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="관리자 권한 회수"
        description={`${nickname} 님을 일반 사용자로 되돌립니다. 계정과 작성 이력은 그대로 남습니다.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="adminId" value={adminId} />

          <FormBanner message={state.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button variant="danger" type="submit" disabled={isPending}>
              {isPending ? '처리 중…' : '권한 회수'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
