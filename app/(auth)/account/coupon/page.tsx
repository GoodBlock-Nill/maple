import { CouponForm } from '@/components/account/CouponForm'
import { CouponHistory } from '@/components/account/CouponHistory'
import { MyPageShell } from '@/components/account/MyPageShell'
import { MYPAGE_COUPON_PATH } from '@/components/account/mypage-tabs'
import { requireAccountSession, toShellUser } from '@/lib/auth/account-guard'
import { getMyCouponRedemptions } from '@/lib/data/coupons'

import type { Metadata } from 'next'

/** 본인만 보는 화면이라 검색 노출을 막는다. */
export const metadata: Metadata = {
  title: '쿠폰 등록',
  description: '쿠폰 코드를 등록하고 등록 이력을 확인합니다.',
  robots: { index: false, follow: false },
}

/**
 * 마이페이지 — 쿠폰 탭(시안 2041:3128).
 *
 * UID·프로필 코드는 프로필에 값이 있으면 미리 채운다. 첫 등록에서 비어 있던 칸은
 * RPC 가 프로필에 채워 주므로(빈 칸만 채운다) 다음 방문부터는 코드만 넣으면 된다.
 *
 * 등록 폼 아래에 "쿠폰 등록 내역" 카드가 이어진다. 등록은 즉시 지급이 아니라 접수라서,
 * 폼만 있는 화면은 "눌렀는데 아무 일도 없다"로 끝난다 — 내역이 그 뒤를 이어 받는다.
 * 두 카드를 `CouponForm` 이 감싸는 것은 방금 만든 줄의 id 를 넘겨주기 위해서다.
 */
export default async function CouponPage() {
  const session = await requireAccountSession(MYPAGE_COUPON_PATH)
  /* 조회는 `auth.uid()` 를 보는 RPC 다 — 세션의 userId 를 넘기지 않는다. */
  const history = await getMyCouponRedemptions()

  return (
    <MyPageShell activeHref={MYPAGE_COUPON_PATH} user={toShellUser(session)}>
      <CouponForm
        defaultMswUid={session.profile.msw_uid ?? ''}
        defaultMswProfileCode={session.profile.msw_profile_code ?? ''}
      >
        <CouponHistory history={history} />
      </CouponForm>
    </MyPageShell>
  )
}
