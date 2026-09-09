import { AuthCard } from '@/components/auth/AuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { firstValue } from '@/lib/utils/table-query'
import { loginErrorMessage, sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '로그인',
}

/**
 * 관리자 로그인 — 이메일 + 비밀번호 한 가지뿐이다.
 *
 * 간편로그인 버튼은 2026-09-09 제품 결정으로 없앴다. 관리자 계정은 사용자 사이트의
 * 회원과 무관하게 **초대 메일로만** 만들어지고(초대받은 사람이 스스로 비밀번호를
 * 정한다), 그렇게 만든 계정의 로그인 수단은 비밀번호 하나다. 소셜 버튼을 남겨 두면
 * 글자월드 회원 누구나 눌러 보고 "권한이 없다"고 튕기는 문만 늘어난다.
 */
export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))
  const initialError = loginErrorMessage(firstValue(searchParams.error)) ?? ''

  return (
    <AuthCard title="관리자 로그인" description="초대받은 관리자 계정으로 로그인하세요.">
      <LoginForm
        nextPath={nextPath}
        initialError={initialError}
        /* 로컬 개발 편의용 미리 채움. 운영(Vercel)에는 설정하지 않는다 —
           공개 URL 의 HTML 에 관리자 비밀번호가 그대로 실리기 때문이다. */
        prefill={{
          email: process.env.ADMIN_LOGIN_PREFILL_EMAIL ?? '',
          password: process.env.ADMIN_LOGIN_PREFILL_PASSWORD ?? '',
        }}
      />
    </AuthCard>
  )
}
