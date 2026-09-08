import Link from 'next/link'

import { AUTH_LINK_CLASS } from '@/components/auth/auth-styles'
import { AuthCard } from '@/components/auth/AuthCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '비밀번호 찾기',
  description: '가입한 이메일로 비밀번호 재설정 링크를 보내드립니다.',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage(_props: PageProps<'/forgot-password'>) {
  return (
    <AuthCard
      title="비밀번호 찾기"
      description="가입할 때 사용한 이메일로 재설정 링크를 보내드립니다."
      footer={
        <>
          비밀번호가 기억나셨나요?{' '}
          <Link href="/login" className={AUTH_LINK_CLASS}>
            로그인
          </Link>
        </>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  )
}
