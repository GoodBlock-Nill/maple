/** 사이트 전역 상수. 추후 Supabase `site_settings` 테이블 값으로 교체된다. */

export type NavItem = {
  label: string
  href: string
}

/** TODO: site_settings.name 으로 교체 예정인 플레이스홀더. */
export const SITE_NAME = '글자월드'

export const SITE_DESCRIPTION =
  '메이플스토리 월드에서 만나는 새로운 모험. 공지, 패치노트, 이벤트와 커뮤니티를 한곳에서.'

/** 히어로 H1. */
export const SITE_HEADLINE = `새로운 즐거움의 시작, ${SITE_NAME}`

/** 히어로 서브카피 겸 푸터 소개문. */
export const SITE_TAGLINE = `지금 바로 ${SITE_NAME}에서 당신만의 특별한 메이플 이야기를 펼쳐보세요.`

/** TODO: site_settings.contact_email 로 교체 예정인 플레이스홀더. */
export const CONTACT_EMAIL = 'contact@example.com'

export const PLAY_URL = '/play'

export const DISCORD_URL = '/discord'

export const NAV_ITEMS: readonly NavItem[] = [
  { label: '소개', href: '/about' },
  { label: '뉴스', href: '/news' },
  { label: '커뮤니티', href: '/community' },
  { label: '가이드', href: '/guide' },
  { label: '고객지원', href: '/support' },
]

/**
 * 푸터 Menu 열. 시안 GNB 는 5개로 고정이라 랭킹을 헤더에 넣지 않는 대신
 * 푸터에서만 진입점을 제공한다.
 */
export const FOOTER_MENU_LINKS: readonly NavItem[] = [
  ...NAV_ITEMS.slice(0, 4),
  { label: '랭킹', href: '/ranking' },
  ...NAV_ITEMS.slice(4),
]

export const POLICY_LINKS: readonly NavItem[] = [
  { label: '개인정보처리방침', href: '/policy/privacy' },
  { label: '디스코드 운영정책', href: '/policy/discord' },
]

export type SnsLink = NavItem & {
  icon: string
  /** 아이콘 SVG 자체 크기(px). 32×32 플레이트 안에 중앙 정렬한다. */
  width: number
  height: number
  /** SVG가 배경 플레이트를 직접 그리는지 여부. */
  hasOwnPlate: boolean
}

export const SNS_LINKS: readonly SnsLink[] = [
  {
    label: '유튜브',
    href: '/sns/youtube',
    icon: '/images/brand/sns-youtube.svg',
    width: 32,
    height: 32,
    hasOwnPlate: true,
  },
  {
    label: '디스코드',
    href: DISCORD_URL,
    icon: '/images/brand/sns-discord.svg',
    width: 16,
    height: 12.2,
    hasOwnPlate: false,
  },
  {
    label: '페이스북',
    href: '/sns/facebook',
    icon: '/images/brand/sns-facebook.svg',
    width: 9,
    height: 15.75,
    hasOwnPlate: false,
  },
]

/**
 * IP 고지 문구.
 * TODO: 최종 문구는 사용자 확정 후 교체 예정(플랫폼 고지 요건 검토 중).
 */
export const IP_NOTICE = `본 사이트는 넥슨(주)의 메이플스토리 월드 플랫폼에서 서비스되는 ${SITE_NAME} 월드의 공식 홈페이지입니다. 'MapleStory' 및 관련 지식재산권은 NEXON Korea Corp.에 있습니다. 'MapleStory Worlds' 및 관련 지식재산권은 Toben Studio Inc.에 있습니다.`
