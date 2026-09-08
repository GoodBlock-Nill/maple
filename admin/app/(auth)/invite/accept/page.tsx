import { AuthCard } from '@/components/auth/AuthCard'
import { SetPasswordForm } from '@/components/auth/SetPasswordForm'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '관리자 초대 수락',
}

/**
 * 초대 메일 링크의 최종 착지점.
 *
 * 여기서 권한을 부여하지 않는다. role='admin' 은 `handle_new_user()` 트리거가
 * `admin_invites` 의 pending 행을 보고 **가입 시점에** 이미 정해 둔 값이다.
 * 이 화면이 하는 일은 비밀번호 설정뿐이다 — 화면 입력이 권한의 근거가 되면
 * 그 순간 권한 상승 창구가 된다.
 */
export default function InviteAcceptPage() {
  return (
    <AuthCard
      title="관리자 초대 수락"
      description="사용할 비밀번호를 설정하면 바로 관리자 화면으로 들어갑니다."
    >
      <SetPasswordForm submitLabel="비밀번호 설정하고 시작하기" />
    </AuthCard>
  )
}
