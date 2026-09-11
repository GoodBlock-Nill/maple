import { MswLinkCard } from '@/components/account/MswLinkCard'
import { MyPageShell } from '@/components/account/MyPageShell'
import { MYPAGE_LINK_PATH } from '@/components/account/mypage-tabs'
import { requireAccountSession, toShellUser } from '@/lib/auth/account-guard'
import { FEATURES } from '@/lib/constants/features'

import type { Metadata } from 'next'

/** 본인만 보는 화면이라 검색 노출을 막는다. */
export const metadata: Metadata = {
  title: '계정 연동',
  description: '글자월드 계정 UID와 프로필 코드를 연동합니다.',
  robots: { index: false, follow: false },
}

/**
 * 마이페이지 — 계정 연동 탭(시안 v2 166:13216).
 *
 * 월드 계정 입력 플래그(`NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS`)가 꺼져 있으면
 * 화면은 그대로 두고 입력·버튼만 비활성으로 그린다 — 사이드바의 "준비중" 배지와
 * 같은 사실이다.
 */
export default async function AccountLinkPage() {
  const session = await requireAccountSession(MYPAGE_LINK_PATH)
  const { profile } = session

  return (
    <MyPageShell activeHref={MYPAGE_LINK_PATH} user={toShellUser(session)}>
      <MswLinkCard
        activeHref={MYPAGE_LINK_PATH}
        mswUid={profile.msw_uid ?? ''}
        mswProfileCode={profile.msw_profile_code ?? ''}
        enabled={FEATURES.mswAccountFields}
      />
    </MyPageShell>
  )
}
