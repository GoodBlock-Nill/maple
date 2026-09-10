import { redirect } from 'next/navigation'

import { AuthScene } from '@/components/auth/AuthScene'
import { LOGIN_SCENE_HEIGHT } from '@/components/auth/auth-scene-styles'
import { AuthSceneCard } from '@/components/auth/AuthSceneCard'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'
import { createClient } from '@/lib/supabase/server'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '비밀번호 재설정',
  description: '새 비밀번호를 설정합니다.',
  robots: { index: false, follow: false },
}

/**
 * 재설정 화면.
 *
 * 프록시(`PROTECTED_PREFIXES`)가 낙관적으로 한 번 걸러 주지만, 인가의 최종
 * 판단은 서버다 — 메일 링크가 만든 세션이 없으면 비밀번호 찾기로 되돌린다.
 */
export default async function ResetPasswordPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect('/forgot-password')
  }

  return (
    /* 카드가 짧아도 하늘·달 배경은 로그인과 같은 자리에 있어야 이음매가 없다. */
    <AuthScene sky="login" sceneHeight={LOGIN_SCENE_HEIGHT}>
      <AuthSceneCard title="비밀번호 재설정">
        <ResetPasswordForm />
      </AuthSceneCard>
    </AuthScene>
  )
}
