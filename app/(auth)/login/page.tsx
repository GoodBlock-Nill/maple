import { AUTH_ERROR_MESSAGE } from '@/components/auth/auth-styles'
import { AuthCard } from '@/components/auth/AuthCard'
import { SocialSignInCard } from '@/components/auth/SocialSignInCard'
import { firstValue } from '@/lib/utils/list-query'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '로그인',
  description: '간편로그인으로 글자월드 커뮤니티에 참여하세요.',
  robots: { index: false, follow: false },
}

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))
  const errorKey = firstValue(searchParams.error) ?? ''

  return (
    <AuthCard
      title="로그인"
      description="간편로그인으로 3초 만에 시작하세요 — 처음이라면 자동으로 가입됩니다"
    >
      <SocialSignInCard nextPath={nextPath} initialError={AUTH_ERROR_MESSAGE[errorKey]} />
    </AuthCard>
  )
}
