import { AuthScene } from '@/components/auth/AuthScene'
import { SIGNUP_SCENE_HEIGHT } from '@/components/auth/auth-scene-styles'
import { AuthSceneCard } from '@/components/auth/AuthSceneCard'
import { SignupForm } from '@/components/auth/SignupForm'
import { firstValue } from '@/lib/utils/list-query'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '회원가입',
  description: '이메일 인증으로 글자월드 계정을 만드세요.',
  robots: { index: false, follow: false },
}

export default async function SignupPage(props: PageProps<'/signup'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))

  return (
    <AuthScene sky="signup" sceneHeight={SIGNUP_SCENE_HEIGHT}>
      <AuthSceneCard title="회원가입">
        <SignupForm nextPath={nextPath} />
      </AuthSceneCard>
    </AuthScene>
  )
}
