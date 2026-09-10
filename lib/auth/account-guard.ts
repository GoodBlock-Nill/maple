import 'server-only'

import { redirect } from 'next/navigation'

import { isWithdrawnProfile } from '@/lib/auth/lifecycle'
import { getAccountProfile } from '@/lib/data/profiles'
import { createClient } from '@/lib/supabase/server'
import {
  isOnboardingComplete,
  isSocialProvider,
  ONBOARDING_PATH,
  RESTORE_PATH,
} from '@/lib/validation/auth'

import type { AccountProfile } from '@/lib/data/profiles'
import type { SocialProvider } from '@/lib/validation/auth'

/**
 * 마이페이지 세 화면의 공통 관문.
 *
 * 프록시(`proxy.ts`)가 `/account` 접두사에 대해 같은 판정을 먼저 하지만, 여기서
 * 다시 확인한다 — 인가의 최종 판단은 서버(그리고 RLS)에 있고, 프록시의 검사는
 * 어디까지나 낙관적이다(쿠키만 본다).
 *
 * 세 화면이 각자 이 순서를 베끼면 언젠가 한 화면만 빠뜨린다. 순서 자체가 규칙이다.
 *   미로그인 → 로그인   ·   탈퇴 대기 → 복구   ·   온보딩 미완료 → 온보딩
 */

const LOGIN_PATH = '/login'

export type AccountSession = {
  userId: string
  /** auth 의 이메일. 프로필 컬럼이 비어 있을 때의 폴백이자 재인증 키다. */
  email: string | null
  profile: AccountProfile
}

export async function requireAccountSession(nextPath: string): Promise<AccountSession> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(nextPath)}`)
  }

  const profile = await getAccountProfile(user.id)

  if (isWithdrawnProfile(profile)) {
    redirect(`${RESTORE_PATH}?next=${encodeURIComponent(nextPath)}`)
  }

  if (profile === null || !isOnboardingComplete(profile)) {
    redirect(`${ONBOARDING_PATH}?next=${encodeURIComponent(nextPath)}`)
  }

  return { userId: user.id, email: user.email ?? null, profile }
}

/**
 * 화면(헤더·사이드바)이 쓰는 최소 사용자 모양.
 *
 * 이 관문을 통과한 시점에서 탈퇴 대기 계정은 없다 — 헤더가 "계정 복구" 버튼으로
 * 바뀌는 분기는 여기서 절대 켜지지 않는다.
 */
export type ShellUser = {
  nickname: string
  avatarUrl: string | null
  provider: SocialProvider | null
  isWithdrawn: boolean
}

export function toShellUser(session: AccountSession): ShellUser {
  const { provider } = session.profile

  return {
    nickname: session.profile.nickname,
    avatarUrl: session.profile.avatar_url,
    /* DB 컬럼은 자유 문자열이라 알려진 세 값으로 좁힌다. 이메일 계정은 브랜드
       마크가 없으므로 null 이고, 헤더가 중립 폴백으로 그린다. */
    provider: isSocialProvider(provider) ? provider : null,
    isWithdrawn: false,
  }
}
