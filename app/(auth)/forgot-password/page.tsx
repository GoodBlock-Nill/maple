import { AuthScene } from '@/components/auth/AuthScene'
import { LOGIN_SCENE_HEIGHT } from '@/components/auth/auth-scene-styles'
import { AuthSceneCard } from '@/components/auth/AuthSceneCard'
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '비밀번호 찾기',
  description: '가입한 이메일로 비밀번호 재설정 메일을 받습니다.',
  robots: { index: false, follow: false },
}

export default function ForgotPasswordPage() {
  return (
    /* 카드가 짧아도 하늘·달 배경은 로그인과 같은 자리에 있어야 이음매가 없다. */
    <AuthScene sky="login" sceneHeight={LOGIN_SCENE_HEIGHT}>
      <AuthSceneCard title="비밀번호 찾기">
        <ForgotPasswordForm />
      </AuthSceneCard>
    </AuthScene>
  )
}
