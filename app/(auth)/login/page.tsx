import { AUTH_ERROR_MESSAGE } from '@/components/auth/auth-styles'
import { AuthScene } from '@/components/auth/AuthScene'
import { LOGIN_SCENE_HEIGHT } from '@/components/auth/auth-scene-styles'
import { AuthSceneCard } from '@/components/auth/AuthSceneCard'
import { LoginForm } from '@/components/auth/LoginForm'
import { firstValue } from '@/lib/utils/list-query'
import { sanitizeNextPath } from '@/lib/validation/auth'
import { LOGIN_NOTICE_MESSAGE } from '@/lib/validation/email-auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '로그인',
  description: '글자월드 계정으로 로그인하세요.',
  robots: { index: false, follow: false },
}

export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))
  const errorKey = firstValue(searchParams.error) ?? ''
  const noticeKey = firstValue(searchParams.notice) ?? ''

  return (
    <AuthScene sky="login" sceneHeight={LOGIN_SCENE_HEIGHT}>
      <AuthSceneCard title="로그인">
        <LoginForm
          nextPath={nextPath}
          initialError={AUTH_ERROR_MESSAGE[errorKey]}
          notice={LOGIN_NOTICE_MESSAGE[noticeKey]}
        />
      </AuthSceneCard>
    </AuthScene>
  )
}
