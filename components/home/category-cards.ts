/**
 * NEWS & COMMUNITY 카드 데이터.
 *
 * Tailwind v4는 클래스 문자열을 정적으로 스캔하므로 색/좌표는 반드시
 * 완전한 클래스 문자열로 둔다(동적 보간 금지).
 * 좌표는 Figma 프레임(1440×1102) 기준이며 뷰포트 1440 이상에서만 적용된다.
 * 좌표·회전은 시안 렌더(home.png)와 픽셀 대조해 보정한 값이다.
 */
export type CategoryCardItem = {
  key: 'notice' | 'patch' | 'free' | 'support'
  title: string
  english: string
  href: string
  art: string
  panelClass: string
  positionClass: string
}

export const CATEGORY_CARDS: readonly CategoryCardItem[] = [
  {
    key: 'notice',
    title: '공지사항',
    english: 'Notice',
    href: '/news?category=notice',
    art: '/images/home/card-notice.png',
    panelClass: 'bg-card-notice',
    positionClass: 'frame:absolute frame:top-[394px] frame:left-[77px] frame:rotate-[-5.7deg]',
  },
  {
    key: 'patch',
    title: '패치노트',
    english: 'Patch notes',
    href: '/news?category=patch',
    art: '/images/home/card-patch.png',
    panelClass: 'bg-card-patch',
    positionClass: 'frame:absolute frame:top-[394px] frame:left-[381px] frame:rotate-[4.9deg]',
  },
  {
    key: 'free',
    title: '자유게시판',
    english: 'Community',
    href: '/community',
    art: '/images/home/card-free.png',
    panelClass: 'bg-card-free',
    positionClass: 'frame:absolute frame:top-[392px] frame:left-[703px] frame:rotate-[-10.4deg]',
  },
  {
    key: 'support',
    title: '고객지원',
    english: 'Support',
    href: '/support',
    art: '/images/home/card-support.png',
    panelClass: 'bg-card-support',
    positionClass: 'frame:absolute frame:top-[393px] frame:left-[1028px] frame:rotate-[5.1deg]',
  },
]
