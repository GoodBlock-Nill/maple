import localFont from 'next/font/local'

import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/constants/site'

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
 * Maplestory 서체 — 소개 페이지의 크리에이터 이름/슬로건 전용.
 * `--font-maple` 은 globals.css 의 `--font-display` 체인 맨 앞에 놓이므로
 * `font-display` 유틸리티를 쓰는 곳에서만 적용된다(본문은 계속 Pretendard).
 * TODO: 상용 라이선스 확인 전까지는 소개 페이지 표제에만 제한적으로 사용한다.
 */
const maplestory = localFont({
  src: [
    { path: './fonts/MaplestoryLight.ttf', weight: '400', style: 'normal' },
    { path: './fonts/MaplestoryBold.ttf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-maple',
})

export const metadata: Metadata = {
  title: {
    default: `${SITE_NAME} 공식 홈페이지`,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: {
    type: 'website',
    locale: 'ko_KR',
    siteName: SITE_NAME,
    title: `${SITE_NAME} 공식 홈페이지`,
    description: SITE_DESCRIPTION,
  },
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
