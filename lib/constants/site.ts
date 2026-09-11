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
  '추억은 그대로, 감성은 더 새롭게 빅뱅 이후 그 시절 메이플 감성을 담은 글자월드에서 지금 다시, 우리의 추억을 플레이해보세요!'

/** OG/메타 `keywords`. */
export const SITE_KEYWORDS = ['글자월드', '메이플스토리월드', 'MSW']

/**
 * OG 대표 이미지(960×540). `metadataBase` 기준으로 절대 URL 로 변환된다
 * (`app/layout.tsx` `generateMetadata`).
 */
export const OG_IMAGE = {
  url: '/images/og.png',
  width: 960,
  height: 540,
  alt: '글자월드 — 추억은 그대로, 감성은 더 새롭게',
}

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
  { label: '마케팅 정보 수신 동의', href: '/policy/marketing' },
]

/**
 * 푸터 Legal 열. 시안 v2 §5 는 세 문서만 세운다 — "마케팅 정보 수신 동의"는
 * 가입·마이페이지의 동의 흐름 안에서 읽는 문서라 푸터에서는 뺀다(문서 자체는
 * `/policy/marketing` 에 그대로 열려 있다).
 */
export const FOOTER_POLICY_LINKS: readonly NavItem[] = POLICY_LINKS.filter(
  (link) => link.href !== '/policy/marketing',
)

/**
 * IP 고지 문구.
 *
 * 시안 v3 푸터(footer-v3-home.png)는 이 문단을 패널 안에 4줄로 넣는다.
 * `\n` 로 줄을 나눠 저장한다 — `FooterIpNotice` 가 `splitIpNoticeLines()` 로
 * 그 줄들을 `<br>` 로 이어 붙인다(`lib/utils/ip-notice.ts`).
 * `site_settings.ip_notice` 폴백 — 최종 문구는 관리자에서 갱신한다.
 */
export const IP_NOTICE = [
  '본 서버는 넥슨(주)의 메이플스토리월드 플랫폼에서 공식 출시된 글자월드입니다.',
  "'MapleStory' 및 관련 지식재산권은 NEXON Korea Corp.에 있습니다.",
  "'MapleStory Worlds' 및 관련 지식재산권은 Toben Studio Inc.에 있습니다.",
  '본 서비스는 이용약관 및 가이드라인을 준수하여 운영됩니다.',
].join('\n')
