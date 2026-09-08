'use client'

import { useActionState, useCallback, useState } from 'react'

import { MemberNicknameDialog } from '@/components/members/MemberNicknameDialog'
import { MemberSuspendDialog } from '@/components/members/MemberSuspendDialog'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { changeMemberRoleAction, unsuspendMemberAction } from '@/lib/actions/members-actions'

import type { FormState } from '@/lib/actions/form-state'
import type { UserRole } from '@/lib/supabase/types'

/**
 * 회원 상세의 조치 모음.
 *
 * 계정 삭제 버튼은 두지 않는다(이번 범위 밖). `profiles` 를 지우면 auth 사용자와
 * 작성 이력이 연쇄로 끊기므로, 필요해지면 별도 절차로 다뤄야 한다.
 */
export function MemberActions({
  memberId,
  nickname,
  role,
  isSuspended,
  isSelf,
}: {
  memberId: string
  nickname: string
  role: UserRole
  isSuspended: boolean
  isSelf: boolean
}) {
  const { showToast } = useToast()
  const [isRoleOpen, setRoleOpen] = useState(false)

  const withToast = useCallback(
    (action: (state: FormState, formData: FormData) => Promise<FormState>, onDone?: () => void) =>
      async (state: FormState, formData: FormData): Promise<FormState> => {
        const result = await action(state, formData)

        if (result.message !== undefined) {
          showToast(result.message, 'success')
          onDone?.()
        }

        if (result.formError !== undefined) {
          showToast(result.formError, 'error')
        }

        return result
      },
    [showToast],
  )

  const [, unsuspendAction, isUnsuspendPending] = useActionState(
    withToast(unsuspendMemberAction),
    EMPTY_FORM_STATE,
  )
  const [roleState, roleAction, isRolePending] = useActionState(
    withToast(changeMemberRoleAction, () => setRoleOpen(false)),
    EMPTY_FORM_STATE,
  )

  const nextRole: UserRole = role === 'admin' ? 'user' : 'admin'

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MemberSuspendDialog memberId={memberId} nickname={nickname} isSuspended={isSuspended} />

      {isSuspended && (
        <form action={unsuspendAction}>
          <input type="hidden" name="memberId" value={memberId} />
          <Button type="submit" variant="secondary" size="sm" disabled={isUnsuspendPending}>
            {isUnsuspendPending ? '해제 중…' : '정지 해제'}
          </Button>
        </form>
      )}

      <MemberNicknameDialog memberId={memberId} nickname={nickname} />

      {isSelf ? (
        <span className="text-muted text-[12px]">본인 권한은 바꿀 수 없습니다.</span>
      ) : (
        <Button variant="ghost" size="sm" onClick={() => setRoleOpen(true)}>
          {role === 'admin' ? '관리자 권한 회수' : '관리자 권한 부여'}
        </Button>
      )}

      <Dialog
        open={isRoleOpen}
        onClose={() => setRoleOpen(false)}
        title={role === 'admin' ? '관리자 권한 회수' : '관리자 권한 부여'}
        description={
          role === 'admin'
            ? `${nickname} 님을 일반 사용자로 되돌립니다. 계정과 작성 이력은 그대로 남습니다.`
            : `${nickname} 님에게 관리 콘솔 전체 권한을 부여합니다. 초대 기록(admin_invites)이 함께 남습니다.`
        }
      >
        <form action={roleAction} className="flex flex-col gap-4">
          <input type="hidden" name="memberId" value={memberId} />
          <input type="hidden" name="role" value={nextRole} />

          <FormBanner message={roleState.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setRoleOpen(false)} disabled={isRolePending}>
              취소
            </Button>
            <Button
              type="submit"
              variant={role === 'admin' ? 'danger' : 'primary'}
              disabled={isRolePending}
            >
              {isRolePending ? '처리 중…' : '확인'}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  )
}
