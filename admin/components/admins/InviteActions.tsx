'use client'

import { useActionState, useCallback } from 'react'

import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { resendInviteAction, revokeInviteAction } from '@/lib/actions/admin-invite-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 수락 대기 초대의 조치 — 재발송 · 취소.
 *
 * 확인 다이얼로그를 세우지 않는다. 둘 다 되돌리기 쉬운 조작이고(취소한 초대는 다시
 * 보내면 된다), 모든 조작을 다이얼로그로 감싸면 운영자가 습관적으로 확인을 눌러
 * 결국 아무것도 막지 못한다.
 */
export function InviteActions({ inviteId, email }: { inviteId: string; email: string }) {
  const { showToast } = useToast()

  const withToast = useCallback(
    (action: (state: FormState, formData: FormData) => Promise<FormState>) =>
      async (state: FormState, formData: FormData): Promise<FormState> => {
        const result = await action(state, formData)

        if (result.message !== undefined) {
          showToast(result.message, 'success')
        }

        if (result.formError !== undefined) {
          showToast(result.formError, 'error')
        }

        return result
      },
    [showToast],
  )

  const [, resendAction, isResending] = useActionState(
    withToast(resendInviteAction),
    EMPTY_FORM_STATE,
  )
  const [, revokeAction, isRevoking] = useActionState(
    withToast(revokeInviteAction),
    EMPTY_FORM_STATE,
  )

  return (
    <span className="flex items-center justify-end gap-1.5">
      <form action={resendAction}>
        <input type="hidden" name="inviteId" value={inviteId} />
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          disabled={isResending || isRevoking}
          aria-label={`${email} 초대 재발송`}
        >
          {isResending ? '보내는 중…' : '재발송'}
        </Button>
      </form>

      <form action={revokeAction}>
        <input type="hidden" name="inviteId" value={inviteId} />
        <Button
          type="submit"
          size="sm"
          variant="ghost"
          disabled={isResending || isRevoking}
          aria-label={`${email} 초대 취소`}
        >
          {isRevoking ? '취소 중…' : '취소'}
        </Button>
      </form>
    </span>
  )
}
