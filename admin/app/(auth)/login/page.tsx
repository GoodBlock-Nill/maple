import { AuthCard } from '@/components/auth/AuthCard'
import { PasswordLoginSection } from '@/components/auth/PasswordLoginSection'
import { SocialSignInButtons } from '@/components/auth/SocialSignInButtons'
import { firstValue } from '@/lib/utils/table-query'
import { isPasswordLoginEnabled, loginErrorMessage, sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '로그인',
}

/**
 * 관리자 로그인.
 *
 * 기본 수단은 간편로그인이다 — 관리자는 사용자 사이트에 가입한 회원 중
 * 회원 상세에서 권한을 부여받은 계정이므로 로그인 문도 같아야 한다
 * (2026-09-09 제품 결정). 이메일 로그인은 실 OAuth 연동 전까지만 남기는
 * 보조 통로라 접어 두고, `ADMIN_PASSWORD_LOGIN=disabled` 로 닫을 수 있다.
 */
export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))
  const initialError = loginErrorMessage(firstValue(searchParams.error)) ?? ''

  return (
    <AuthCard
      title="관리자 로그인"
      description="글자월드에 가입한 계정 중 관리자 권한이 부여된 계정으로 로그인합니다."
    >
      <SocialSignInButtons nextPath={nextPath} initialError={initialError} />

      {isPasswordLoginEnabled(process.env.ADMIN_PASSWORD_LOGIN) && (
        <PasswordLoginSection nextPath={nextPath} />
      )}
    </AuthCard>
  )
}
