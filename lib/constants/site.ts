/**
 * 사이트 전역 상수.
 *
 * `site_settings` 로 옮겨진 값들의 **폴백**이다. 단일 출처는 DB(`getSiteSettings()`)
 * 이고, 여기 값은 설정 행을 못 읽거나 해당 칸이 비어 있을 때만 쓰인다
 * (`lib/data/site-view.ts` 가 그 합류 지점이다).
 */

export type NavItem = {
  label: string
  href: string
}

/** `site_settings.game_name` 폴백. */
export const SITE_NAME = '글자월드'

export const SITE_DESCRIPTION =
  '메이플스토리 월드에서 만나는 새로운 모험. 공지, 패치노트, 이벤트와 커뮤니티를 한곳에서.'

/** 히어로 H1. */
export const SITE_HEADLINE = `새로운 즐거움의 시작, ${SITE_NAME}`

/** 히어로 서브카피 겸 푸터 소개문. */
export const SITE_TAGLINE = `지금 바로 ${SITE_NAME}에서 당신만의 특별한 메이플 이야기를 펼쳐보세요.`

/** `site_settings.contact_email` 폴백(화면 표기형). */
export const CONTACT_EMAIL = 'care@gjstory.com'

/**
 * `mailto:` 링크용 이메일.
 *
 * 예전 연락처(`contact@글자월드.co.kr`)는 한글(IDN) 도메인이라 `mailto:` href 에는
 * ASCII(Punycode) 변환이 필요했다. 지금 도메인(`gjstory.com`)은 처음부터 ASCII 라
 * 변환이 필요 없어 `CONTACT_EMAIL` 과 값이 같다 — 그래도 상수를 분리해 두는 이유는
 * 관리자가 DB 에 다시 IDN 도메인을 입력하는 경우까지 대비한 `toAsciiEmail()` 변환
 * 경로(`lib/utils/email.ts`)를 그대로 살려 두기 위해서다. 실제 푸터는 이 상수를
 * 직접 읽지 않고 그 변환을 거쳐 쓴다 — `tests/unit/utils/email.test.ts`.
 */
export const CONTACT_EMAIL_HREF = 'care@gjstory.com'

/**
 * `site_settings.copyright` 폴백. 시안 푸터 문구 그대로다.
 * DB 에 값이 있으면 그 문장을 통째로(연도 표기 포함) 대신 쓴다.
 */
export const COPYRIGHT = `Copyright © ${SITE_NAME}. All rights reserved.`

export const PLAY_URL = '/play'

export const DISCORD_URL = '/discord'

/**
 * 헤더 GNB. 시안(home.png)은 5개지만 `/ranking` 진입점이 필요해
 * 가이드와 고객지원 사이에 랭킹을 넣었다(사용자 요청).
 */
export const NAV_ITEMS: readonly NavItem[] = [
  { label: '소개', href: '/about' },
  { label: '뉴스', href: '/news' },
  { label: '커뮤니티', href: '/community' },
  { label: '가이드', href: '/guide' },
  { label: '랭킹', href: '/ranking' },
  { label: '고객지원', href: '/support' },
]

/**
 * 푸터 Menu 열. GNB 와 같은 6개를 노출한다(사용자 요청).
 * 링크가 6줄(16px + 간격 12px = 28px 피치)이 돼도 열 높이 190px 은 좌측
 * 열(193px)보다 낮아 글래스 패널 353px 과 구분선 위치는 그대로다.
 */
export const FOOTER_MENU_LINKS: readonly NavItem[] = NAV_ITEMS

export const POLICY_LINKS: readonly NavItem[] = [
  { label: '개인정보처리방침', href: '/policy/privacy' },
  { label: '디스코드 운영정책', href: '/policy/discord' },
  { label: '글자월드 운영정책', href: '/policy/operating' },
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
]

/**
 * IP 고지 문구.
 *
 * 시안 푸터(home.png)에는 이 문단이 없고, 넣으면 글래스 패널이 353px 을
 * 넘겨 아래 행 위치가 전부 밀린다. 그래서 푸터에서는 빼고 개인정보처리방침
 * 페이지(`/policy/privacy`)에서만 노출한다.
 * `site_settings.ip_notice` 폴백 — 최종 문구는 관리자에서 갱신한다.
 */
export const IP_NOTICE = `본 사이트는 넥슨(주)의 메이플스토리 월드 플랫폼에서 서비스되는 ${SITE_NAME} 월드의 공식 홈페이지입니다. 'MapleStory' 및 관련 지식재산권은 NEXON Korea Corp.에 있습니다. 'MapleStory Worlds' 및 관련 지식재산권은 Toben Studio Inc.에 있습니다.`
