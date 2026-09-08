import { AuthCard } from '@/components/auth/AuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '비밀번호 재설정',
}

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="비밀번호 재설정"
      description="가입한 이메일로 재설정 링크를 보내 드립니다."
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
