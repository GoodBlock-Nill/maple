import { TabAccountGlyph, TabLinkGlyph } from '@/components/account/mypage-icons'
import { FEATURES } from '@/lib/constants/features'

import type { ComponentType, SVGProps } from 'react'

/** 마이페이지 탭 경로. 프록시의 보호 접두사(`/account`)가 두 경로를 모두 덮는다. */
export const MYPAGE_ACCOUNT_PATH = '/account'
export const MYPAGE_LINK_PATH = '/account/link'

/** 월드 계정 입력 플래그가 꺼져 있을 때 "계정 연동" 옆에 붙는 배지 문구. */
export const MYPAGE_COMING_SOON_LABEL = '준비중'

export type MyPageTab = {
  href: string
  label: string
  Icon: ComponentType<SVGProps<SVGSVGElement>>
  /**
   * 아이콘이 48 박스를 가득 채우는지. 계정 관리 아이콘만 원본이 박스를 포함한
   * 좌표계(62×62)라 박스 크기로 그리고, 계정 연동은 실측 28 로 가운데 둔다.
   */
  fillsBox: boolean
  /**
   * "준비중" 배지 노출 여부. 계정 연동은 월드 계정 입력
   * (`NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS`)이 꺼져 있는 동안만 준비 중이다.
   */
  comingSoon: boolean
}

export const MYPAGE_TABS: readonly MyPageTab[] = [
  {
    href: MYPAGE_ACCOUNT_PATH,
    label: '계정 관리',
    Icon: TabAccountGlyph,
    fillsBox: true,
    comingSoon: false,
  },
  {
    href: MYPAGE_LINK_PATH,
    label: '계정 연동',
    Icon: TabLinkGlyph,
    fillsBox: false,
    comingSoon: !FEATURES.mswAccountFields,
  },
]

/**
 * 활성 탭 판정.
 *
 * `/account` 는 `/account/link` 의 접두사라 `startsWith` 를 쓰면 계정 연동에서도
 * "계정 관리"가 함께 켜진다. 완전 일치로 보되, 하위 경로가 생길 수 있는 계정
 * 연동은 접두사도 인정한다.
 */
export function isMyPageTabActive(pathname: string, href: string): boolean {
  if (href === MYPAGE_ACCOUNT_PATH) {
    return pathname === MYPAGE_ACCOUNT_PATH
  }

  return pathname === href || pathname.startsWith(`${href}/`)
}
