/**
 * NEWS & COMMUNITY 카드 데이터.
 *
 * Tailwind v4는 클래스 문자열을 정적으로 스캔하므로 색/좌표는 반드시
 * 완전한 클래스 문자열로 둔다(동적 보간 금지).
 * 좌표는 Figma 프레임(1440×1102) 기준이며 xl 이상에서만 적용된다.
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
    positionClass: 'xl:absolute xl:top-[394px] xl:left-[77px] xl:rotate-[-5.7deg]',
  },
  {
    key: 'patch',
    title: '패치노트',
    english: 'Patch notes',
    href: '/news?category=patch',
    art: '/images/home/card-patch.png',
    panelClass: 'bg-card-patch',
    positionClass: 'xl:absolute xl:top-[394px] xl:left-[381px] xl:rotate-[4.9deg]',
  },
  {
    key: 'free',
    title: '자유게시판',
    english: 'Community',
    href: '/community',
    art: '/images/home/card-free.png',
    panelClass: 'bg-card-free',
    positionClass: 'xl:absolute xl:top-[392px] xl:left-[703px] xl:rotate-[-10.4deg]',
  },
  {
    key: 'support',
    title: '고객지원',
    english: 'Support',
    href: '/support',
    art: '/images/home/card-support.png',
    panelClass: 'bg-card-support',
    positionClass: 'xl:absolute xl:top-[393px] xl:left-[1028px] xl:rotate-[5.1deg]',
  },
]
