import { AccountManageCard } from '@/components/account/AccountManageCard'
import { MarketingConsentBox } from '@/components/account/MarketingConsentBox'
import { MyPageShell } from '@/components/account/MyPageShell'
import { MYPAGE_ACCOUNT_PATH } from '@/components/account/mypage-tabs'
import { requireAccountSession, toShellUser } from '@/lib/auth/account-guard'

import type { Metadata } from 'next'

/** 본인만 보는 화면이라 검색 노출을 막는다. */
export const metadata: Metadata = {
  title: '마이페이지',
  description: '닉네임과 마케팅 수신 설정을 관리합니다.',
  robots: { index: false, follow: false },
}

/**
 * 마이페이지 — 계정 관리 탭(시안 v2 166:13134).
 *
 * 카드 안은 닉네임·이메일 둘뿐이다. v1 의 아바타·이름·비밀번호 카드는 시안에서
 * 빠졌고(스펙 §3), 쿠폰·문의내역 탭은 경로째 사라져 `/account` 로 돌아간다.
 */
export default async function AccountPage() {
  const session = await requireAccountSession(MYPAGE_ACCOUNT_PATH)
  const { profile } = session

  return (
    <MyPageShell activeHref={MYPAGE_ACCOUNT_PATH} user={toShellUser(session)}>
      <AccountManageCard
        activeHref={MYPAGE_ACCOUNT_PATH}
        nickname={profile.nickname}
        email={profile.email ?? session.email}
      />

      <MarketingConsentBox
        smsOptOut={profile.marketing_sms_opt_out}
        emailOptOut={profile.marketing_email_opt_out}
      />
    </MyPageShell>
  )
}
