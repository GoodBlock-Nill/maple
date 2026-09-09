import { redirect } from 'next/navigation'

import { AuthCard } from '@/components/auth/AuthCard'
import { OnboardingForm } from '@/components/auth/OnboardingForm'
import { isWithdrawnProfile } from '@/lib/auth/lifecycle'
import { createClient } from '@/lib/supabase/server'
import { firstValue } from '@/lib/utils/list-query'
import {
  isOnboardingComplete,
  ONBOARDING_PATH,
  RESTORE_PATH,
  sanitizePostAuthPath,
} from '@/lib/validation/auth'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '시작하기',
  description: '닉네임을 정하고 약관에 동의하면 커뮤니티를 이용할 수 있습니다.',
  robots: { index: false, follow: false },
}

/**
 * 최초 로그인 온보딩.
 *
 * 프록시가 미로그인 접근을 이미 걸러 내지만, 페이지에서도 다시 확인한다.
 * 프록시는 낙관적 검사일 뿐이고 인가의 최종 판단은 서버(그리고 RLS)에 있다.
 */
export default async function OnboardingPage(props: PageProps<'/auth/onboarding'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizePostAuthPath(firstValue(searchParams.next))

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`/login?next=${encodeURIComponent(ONBOARDING_PATH)}`)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'nickname, terms_agreed_at, privacy_agreed_at, age_confirmed_at, msw_uid, msw_profile_code, deleted_at, purged_at',
    )
    .eq('id', user.id)
    .maybeSingle()

  // 탈퇴 대기 계정은 약관을 다시 받기 전에 복구 여부를 먼저 묻는다.
  if (isWithdrawnProfile(profile)) {
    redirect(`${RESTORE_PATH}?next=${encodeURIComponent(nextPath)}`)
  }

  // 이미 마친 사람이 주소로 직접 들어온 경우. 다시 묻지 않는다.
  if (isOnboardingComplete(profile)) {
    redirect(nextPath)
  }

  return (
    <AuthCard
      title="시작하기"
      description="커뮤니티에서 쓸 닉네임과 메이플스토리 월드 계정을 등록하고 약관에 동의해 주세요. 한 번만 하면 됩니다."
    >
      <OnboardingForm
        nextPath={nextPath}
        defaultNickname={profile?.nickname ?? ''}
        defaultMswUid={profile?.msw_uid ?? ''}
        defaultMswProfileCode={profile?.msw_profile_code ?? ''}
      />
    </AuthCard>
  )
}
