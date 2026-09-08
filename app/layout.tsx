import localFont from 'next/font/local'

import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/constants/site'
import { getSiteSettings } from '@/lib/data/site'

import './globals.css'

import type { Metadata, Viewport } from 'next'

const pretendard = localFont({
  src: './fonts/PretendardVariable.woff2',
  weight: '45 920',
  style: 'normal',
  display: 'swap',
  variable: '--font-pretendard',
})

/**
 * Maplestory 서체 — 전 화면 기본 서체.
 *
 * OTF 두 벌(Light 300 · Bold 700)만 있으므로 400~600 요청은 브라우저가
 * 가까운 굵기로 대체한다. 가짜 볼드/이탤릭 합성은 `font-synthesis: none`
 * (globals.css) 으로 막는다. 한글·라틴 모두 이 서체가 받고, 글리프가 없는
 * 문자만 Pretendard 로 폴백한다.
 */
const maplestory = localFont({
  src: [
    { path: './fonts/MaplestoryOTFLight.otf', weight: '300', style: 'normal' },
    { path: './fonts/MaplestoryOTFBold.otf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-maple',
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
    <html lang="ko" className={`${pretendard.variable} ${maplestory.variable} h-full antialiased`}>
      <body className="bg-page text-ink flex min-h-full flex-col">{children}</body>
    </html>
  )
}
