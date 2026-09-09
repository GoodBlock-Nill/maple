'use client'

import { useActionState, useCallback } from 'react'

import { MemberForceWithdrawDialog } from '@/components/members/MemberForceWithdrawDialog'
import { MemberNicknameDialog } from '@/components/members/MemberNicknameDialog'
import { MemberPurgeDialog } from '@/components/members/MemberPurgeDialog'
import { MemberSuspendDialog } from '@/components/members/MemberSuspendDialog'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { unsuspendMemberAction } from '@/lib/actions/members-actions'

import type { FormState } from '@/lib/actions/form-state'
import type { MemberLifecycle } from '@/lib/validation/member-status'

/**
 * 회원 상세의 조치 모음 — 정지 · 정지 해제 · 닉네임 강제 변경 · 강제 탈퇴 · 즉시 파기.
 *
 * **회원을 관리자로 올리는 조작은 없다**(2026-09-09 제품 결정). 관리자는 `/admins`
 * 에서 이메일로 초대해 만든다. 회원 화면에 승격 버튼이 남아 있으면 권한이 생기는
 * 경로가 둘이 되어, 어느 쪽이 역할(admin_role_id)을 정하는지 알 수 없게 된다.
 *
 * 계정 삭제 버튼도 두지 않는다. 삭제는 **탈퇴 → 90일 → 파기** 두 단계로만 일어난다
 * (`docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md` §3). 그래야 글·댓글의 작성자 연결이
 * 끊기지 않는다.
 *
 * 탈퇴 대기 중에도 제재는 그대로 걸고 풀 수 있다 — 복구되면 그 제재가 다시
 * 적용되므로, 여기서 감추면 "탈퇴하면 제재를 못 건다"는 빈틈이 생긴다.
 */
export function MemberActions({
  memberId,
  nickname,
  isSuspended,
  lifecycle,
  isSuperAdmin,
  isSelf,
}: {
  memberId: string
  nickname: string
  isSuspended: boolean
  lifecycle: MemberLifecycle
  isSuperAdmin: boolean
  isSelf: boolean
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

  /* 파기된 계정에는 걸 조치가 없다. 로그인 계정이 사라졌고 제재도 이미 비워져
     있으므로, 버튼을 남겨 두면 눌러 보고 실패 문구만 보게 된다. */
  if (lifecycle === 'purged') {
    return null
  }

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

      {lifecycle === 'active' && !isSelf && (
        <MemberForceWithdrawDialog memberId={memberId} nickname={nickname} />
      )}

      {lifecycle === 'withdrawn' && isSuperAdmin && !isSelf && (
        <MemberPurgeDialog memberId={memberId} nickname={nickname} />
      )}
    </div>
  )
}
