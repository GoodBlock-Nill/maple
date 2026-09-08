import { Inter, Noto_Sans_KR } from 'next/font/google'
import localFont from 'next/font/local'

import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/constants/site'
import { getSiteSettings } from '@/lib/data/site'

import './globals.css'

import type { Metadata, Viewport } from 'next'

/**
 * Switzer — 시안(Figma)의 본문/제목 서체. 거의 모든 텍스트가 이 서체다.
 *
 * 한글 글리프가 없어서 시안에서도 한글은 Figma 기본 한글 폴백(macOS 의
 * Apple SD Gothic Neo)으로 렌더된다. 웹에서는 같은 자리를 Pretendard 가
 * 받도록 `--font-body` 체인을 Switzer → Pretendard 순으로 둔다(tokens.css).
 * 그래서 굵기는 400/500/600/700 실제 컷을 모두 실어야 한다 — 폴백 서체와
 * 굵기가 어긋나면 라틴/한글이 한 줄 안에서 다른 무게로 보인다.
 *
 * 이탤릭은 본문 에디터(Tiptap)의 `<em>` 때문에 함께 싣는다.
 * `font-synthesis: none`(globals.css) 이라 실제 컷이 없으면 기울지 않는다.
 */
const switzer = localFont({
  src: [
    { path: './fonts/Switzer-Regular.otf', weight: '400', style: 'normal' },
    { path: './fonts/Switzer-Italic.otf', weight: '400', style: 'italic' },
    { path: './fonts/Switzer-Medium.otf', weight: '500', style: 'normal' },
    { path: './fonts/Switzer-MediumItalic.otf', weight: '500', style: 'italic' },
    { path: './fonts/Switzer-Semibold.otf', weight: '600', style: 'normal' },
    { path: './fonts/Switzer-SemiboldItalic.otf', weight: '600', style: 'italic' },
    { path: './fonts/Switzer-Bold.otf', weight: '700', style: 'normal' },
    { path: './fonts/Switzer-BoldItalic.otf', weight: '700', style: 'italic' },
  ],
  display: 'swap',
  variable: '--font-switzer',
})

/**
 * Maplestory 서체 — 시안에서 `/소개`의 이름("세글자", 100px)과 그 아래 한 줄
 * 소개말(25px) **딱 두 곳**에만 쓰인다. 전 화면 기본 서체가 아니다.
 * Light(300)·Bold(700) 두 벌뿐이라 그 사이 굵기 요청은 근접 컷으로 대체된다.
 *
 * `preload: false` 인 이유: next/font 는 선언한 파일을 전부 preload 링크로 박는다.
 * 두 벌 합쳐 619KB 인데 쓰이는 곳은 `/소개` 의 텍스트 두 줄뿐이라, 켜 두면 홈·목록
 * 같은 나머지 모든 페이지가 쓰지도 않을 619KB 를 먼저 받는다. 끄면 `/소개` 에서
 * 실제로 글자가 그려질 때만 받는다(`display: swap` 이라 문자는 즉시 보인다).
 */
const maplestory = localFont({
  preload: false,
  src: [
    { path: './fonts/MaplestoryOTFLight.otf', weight: '300', style: 'normal' },
    { path: './fonts/MaplestoryOTFBold.otf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-maple',
})

/**
 * Inter — 시안의 헤더 GNB·인증 버튼, "더보기", 확률형 아이템 카드, 고객지원
 * 큰 제목에 쓰인 UI 서체. 가변 폰트라 500/600 을 파일 하나로 덮는다.
 */
const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

/**
 * Noto Sans KR — 시안 `/소개`의 크리에이터 소개 문단(22px Bold)에만 쓰인다.
 *
 * `preload: false` 인 이유: Noto Sans KR 은 유니코드 구간별로 124개 파일로
 * 쪼개져 있어서 preload 를 켜면 모든 페이지 `<head>` 에 preload 링크가 124개
 * 박힌다. 실제로는 unicode-range 로 필요한 조각만 늦게 받으면 충분하다.
 */
const notoSansKr = Noto_Sans_KR({
  preload: false,
  display: 'swap',
  variable: '--font-noto-kr',
})

/**
 * 사이트 이름은 `site_settings.game_name` 이 단일 출처다. 설정 행을 못 읽어도
 * 메타데이터가 비지 않도록 `lib/constants/site.ts` 의 플레이스홀더로 폴백한다.
 * 조회는 `unstable_cache`(300초)를 거치므로 요청마다 DB 를 때리지 않는다.
 */
export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings()
  const name = settings?.gameName ?? SITE_NAME
  const title = `${name} 공식 홈페이지`

  return {
    title: { default: title, template: `%s | ${name}` },
    description: SITE_DESCRIPTION,
    applicationName: name,
    openGraph: {
      type: 'website',
      locale: 'ko_KR',
      siteName: name,
      title,
      description: SITE_DESCRIPTION,
    },
  }
}

export const viewport: Viewport = {
  themeColor: '#f3f3f3',
  colorScheme: 'light',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="ko"
      className={`${switzer.variable} ${inter.variable} ${notoSansKr.variable} ${maplestory.variable} h-full antialiased`}
    >
      <body className="bg-page text-ink flex min-h-full flex-col">{children}</body>
    </html>
  )
}
