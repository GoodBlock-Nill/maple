import { AuthCard } from '@/components/auth/AuthCard'
import { SetPasswordForm } from '@/components/auth/SetPasswordForm'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '새 비밀번호 설정',
}

/**
 * 재설정 메일 링크의 최종 착지점.
 *
 * 세션 유무를 여기서 검사하지 않는다. 검사하려면 서버에서 쿠키를 읽어야 하는데,
 * 링크를 막 통과한 직후에는 프록시가 세션을 세운 뒤라 결과가 흔들린다. 세션이
 * 없으면 `setPasswordAction` 이 "링크가 만료되었습니다"로 정확히 안내한다.
 */
export default function ResetPasswordPage() {
  return (
    <AuthCard title="새 비밀번호 설정" description="새로 사용할 비밀번호를 입력하세요.">
      <SetPasswordForm submitLabel="비밀번호 변경" />
    </AuthCard>
  )
}
