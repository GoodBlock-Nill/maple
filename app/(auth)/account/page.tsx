import { MarketingCard } from '@/components/account/MarketingCard'
import { MyPageShell } from '@/components/account/MyPageShell'
import { MYPAGE_ACCOUNT_PATH } from '@/components/account/mypage-tabs'
import { PasswordChangeCard } from '@/components/account/PasswordChangeCard'
import { ProfileCard } from '@/components/account/ProfileCard'
import { requireAccountSession, toShellUser } from '@/lib/auth/account-guard'

import type { Metadata } from 'next'

/** 본인만 보는 화면이라 검색 노출을 막는다. */
export const metadata: Metadata = {
  title: '마이페이지',
  description: '프로필과 비밀번호, 마케팅 수신 설정을 관리합니다.',
  robots: { index: false, follow: false },
}

/**
 * 마이페이지 — 계정 관리 탭(시안 2041:2958).
 *
 * 비밀번호 카드는 이메일 계정에만 입력칸이 있다. 판정 근거는 `profiles.provider`
 * 다(마이그레이션 20260908001200 이 'google'|'kakao'|'naver'|'email'|'anonymous'
 * 중 하나로 정규화해 둔다) — auth 쪽 identities 를 다시 읽지 않는다.
 */
export default async function AccountPage() {
  const session = await requireAccountSession(MYPAGE_ACCOUNT_PATH)
  const { profile } = session

  return (
    <MyPageShell activeHref={MYPAGE_ACCOUNT_PATH} user={toShellUser(session)}>
      <ProfileCard
        name={profile.name ?? ''}
        nickname={profile.nickname}
        email={profile.email ?? session.email}
        avatarUrl={profile.avatar_url}
        mswUid={profile.msw_uid ?? ''}
        mswProfileCode={profile.msw_profile_code ?? ''}
      />

      <PasswordChangeCard hasPassword={profile.provider === 'email'} />

      <MarketingCard
        smsOptOut={profile.marketing_sms_opt_out}
        emailOptOut={profile.marketing_email_opt_out}
      />
    </MyPageShell>
  )
}
