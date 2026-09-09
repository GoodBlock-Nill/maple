'use client'

import { useActionState, useCallback } from 'react'

import { MemberNicknameDialog } from '@/components/members/MemberNicknameDialog'
import { MemberSuspendDialog } from '@/components/members/MemberSuspendDialog'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { unsuspendMemberAction } from '@/lib/actions/members-actions'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 회원 상세의 조치 모음 — 정지 · 정지 해제 · 닉네임 강제 변경.
 *
 * **회원을 관리자로 올리는 조작은 없다**(2026-09-09 제품 결정). 관리자는 `/admins`
 * 에서 이메일로 초대해 만든다. 회원 화면에 승격 버튼이 남아 있으면 권한이 생기는
 * 경로가 둘이 되어, 어느 쪽이 역할(admin_role_id)을 정하는지 알 수 없게 된다.
 *
 * 계정 삭제 버튼도 두지 않는다. `profiles` 를 지우면 auth 사용자와 작성 이력이
 * 연쇄로 끊기므로, 필요해지면 별도 절차로 다뤄야 한다.
 */
export function MemberActions({
  memberId,
  nickname,
  isSuspended,
}: {
  memberId: string
  nickname: string
  isSuspended: boolean
}) {
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

  const [, unsuspendAction, isUnsuspendPending] = useActionState(
    withToast(unsuspendMemberAction),
    EMPTY_FORM_STATE,
  )

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
    </div>
  )
}
