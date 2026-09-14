import { INQUIRY_KINDS } from '@/lib/constants/inquiry-kind'
import { MY_INQUIRIES_PATH } from '@/lib/constants/support'

import type { InquiryKind } from '@/lib/constants/inquiry-kind'

/**
 * 고객지원 메뉴(PC 좌측 5행 · 모바일 세그먼트 탭).
 *
 * 앞의 세 항목은 접수 창구라 `INQUIRY_KINDS` 에서 그대로 끌어온다 — 메뉴에 이름과
 * 경로를 다시 적어 두면 창구가 하나 늘 때 두 곳을 고쳐야 하고, 그중 한 곳을 잊으면
 * 메뉴만 옛 이름으로 남는다. 아이콘만 여기서 붙인다(상수 파일은 자산 경로를 모른다).
 */

export type SupportMenuItem = {
  href: string
  label: string
  icon: string
  /** SVG 가 48×48 흰 박스와 그림자를 직접 그리는지 여부. */
  hasOwnPlate: boolean
  /** SVG 원본 크기. 박스를 직접 그리는 자산은 62×62(박스 offset 7,5)다. */
  width: number
  height: number
}

type SupportMenuIcon = Pick<SupportMenuItem, 'icon' | 'hasOwnPlate' | 'width' | 'height'>

/**
 * 창구별 아이콘.
 *
 * 1:1 문의만 흰 박스를 SVG 가 직접 그린다(시안 원본). 버그제보·불법이용제보는
 * 자주 묻는 질문과 같은 선 굵기(2)·크기(26)의 글리프라 화면이 박스를 그린다.
 */
const KIND_ICONS: Record<InquiryKind, SupportMenuIcon> = {
  inquiry: {
    icon: '/images/support/icon-inquiry.svg',
    hasOwnPlate: true,
    width: 62,
    height: 62,
  },
  bug: {
    icon: '/images/support/icon-bug.svg',
    hasOwnPlate: false,
    width: 26,
    height: 26,
  },
  report: {
    icon: '/images/support/icon-report.svg',
    hasOwnPlate: false,
    width: 23,
    height: 26,
  },
}

export const SUPPORT_MENU: readonly SupportMenuItem[] = [
  ...INQUIRY_KINDS.map((kind) => ({
    href: kind.path,
    label: kind.menuLabel,
    ...KIND_ICONS[kind.value],
  })),
  {
    href: '/support/faq',
    label: '자주 묻는 질문',
    icon: '/images/support/icon-faq.svg',
    hasOwnPlate: false,
    width: 27,
    height: 26,
  },
  {
    href: MY_INQUIRIES_PATH,
    label: '내 문의 내역',
    icon: '/images/support/icon-my-inquiries.svg',
    hasOwnPlate: false,
    width: 24,
    height: 26,
  },
]
