import Link from 'next/link'

import { AUTH_LINK_CLASS } from '@/components/auth/auth-styles'
import { AuthCard } from '@/components/auth/AuthCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { firstValue } from '@/lib/utils/list-query'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '로그인',
  description: '글자월드 계정으로 로그인해 커뮤니티에 참여하세요.',
  robots: { index: false, follow: false },
}

/** 인증 라우트 핸들러가 실패를 알릴 때 붙이는 `?error=` 값. */
const ERROR_MESSAGE: Record<string, string> = {
  missing_code: '인증 정보가 없어 로그인을 완료하지 못했습니다. 다시 시도해 주세요.',
  auth_failed: '인증에 실패했습니다. 다시 로그인해 주세요.',
  invalid_link: '메일 링크가 올바르지 않습니다. 다시 요청해 주세요.',
  link_expired: '메일 링크가 만료되었습니다. 다시 요청해 주세요.',
}

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))
  const errorKey = firstValue(searchParams.error) ?? ''
  const errorMessage = ERROR_MESSAGE[errorKey]

  return (
    <AuthCard
      title="로그인"
      description="글자월드 계정으로 로그인하면 글쓰기와 댓글을 이용할 수 있습니다."
      footer={
        <>
          아직 계정이 없으신가요?{' '}
          <Link href="/register" className={AUTH_LINK_CLASS}>
            회원가입
          </Link>
        </>
      }
    >
      {errorMessage === undefined ? null : (
        <p
          role="alert"
          className="border-badge-red/40 text-badge-red mb-5 rounded-[10px] border bg-white/70 px-4 py-3 text-[15px]"
        >
          {errorMessage}
        </p>
      )}

      <LoginForm nextPath={nextPath} />

      <p className="text-ink-muted mt-5 text-center text-[15px]">
        <Link href="/forgot-password" className={AUTH_LINK_CLASS}>
          비밀번호를 잊으셨나요?
        </Link>
      </p>
    </AuthCard>
  )
}
