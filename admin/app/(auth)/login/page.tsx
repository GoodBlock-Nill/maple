import { AuthCard } from '@/components/auth/AuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { firstValue } from '@/lib/utils/table-query'
import { loginErrorMessage, sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '로그인',
}

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))
  const initialError = loginErrorMessage(firstValue(searchParams.error)) ?? ''

  return (
    <AuthCard title="관리자 로그인" description="초대받은 관리자 계정으로 로그인하세요.">
      <LoginForm nextPath={nextPath} initialError={initialError} />
    </AuthCard>
  )
}
