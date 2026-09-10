import { TabAccountGlyph, TabCouponGlyph, TabInquiryGlyph } from '@/components/account/mypage-icons'

import type { ComponentType, SVGProps } from 'react'

/** 마이페이지 탭 경로. 프록시의 보호 접두사(`/account`)가 세 경로를 모두 덮는다. */
export const MYPAGE_ACCOUNT_PATH = '/account'
export const MYPAGE_COUPON_PATH = '/account/coupon'
export const MYPAGE_INQUIRIES_PATH = '/account/inquiries'

export type MyPageTab = {
  href: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  /**
   * 아이콘이 48 박스를 가득 채우는지. 계정 관리 아이콘만 원본이 박스를 포함한
   * 좌표계(62×62)라 박스 크기로 그리고, 나머지는 실측 크기로 가운데 둔다.
   */
  fillsBox: boolean
}

export const MYPAGE_TABS: readonly MyPageTab[] = [
  { href: MYPAGE_ACCOUNT_PATH, label: '계정 관리', Icon: TabAccountGlyph, fillsBox: true },
  { href: MYPAGE_COUPON_PATH, label: '쿠폰', Icon: TabCouponGlyph, fillsBox: false },
  { href: MYPAGE_INQUIRIES_PATH, label: '문의내역', Icon: TabInquiryGlyph, fillsBox: false },
]

/**
 * 활성 탭 판정.
 *
 * `/account` 는 다른 두 경로의 접두사라 `startsWith` 를 쓰면 쿠폰·문의내역에서도
 * "계정 관리"가 함께 켜진다. 완전 일치로 보되, 하위 경로가 생길 수 있는 문의내역은
 * 접두사도 인정한다(상세는 `/support/inquiries/[id]` 로 나가므로 지금은 없다).
 */
export function isMyPageTabActive(pathname: string, href: string): boolean {
  if (href === MYPAGE_ACCOUNT_PATH) {
    return pathname === MYPAGE_ACCOUNT_PATH
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}
