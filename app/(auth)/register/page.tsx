import Link from 'next/link'

import { AUTH_LINK_CLASS } from '@/components/auth/auth-styles'
import { AuthCard } from '@/components/auth/AuthCard'
import { RegisterForm } from '@/components/auth/RegisterForm'
import { firstValue } from '@/lib/utils/list-query'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '회원가입',
  description: '글자월드 계정을 만들고 커뮤니티에 참여하세요.',
  robots: { index: false, follow: false },
}

export default async function RegisterPage(props: PageProps<'/register'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))

  return (
    <AuthCard
      title="회원가입"
      description="이메일과 닉네임만으로 가입할 수 있습니다."
      footer={
        <>
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className={AUTH_LINK_CLASS}>
            로그인
          </Link>
        </>
      }
    >
      <RegisterForm nextPath={nextPath} />
    </AuthCard>
  )
}
