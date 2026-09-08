import localFont from 'next/font/local'

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
 * Maplestory 서체 — 로고와 페이지 제목에만 쓴다(PLAN.md §5).
 * 본문까지 이 서체로 두면 표의 숫자 폭이 흔들려 목록 가독성이 떨어진다.
 */
const maplestory = localFont({
  src: [
    { path: './fonts/MaplestoryOTFLight.otf', weight: '300', style: 'normal' },
    { path: './fonts/MaplestoryOTFBold.otf', weight: '700', style: 'normal' },
  ],
  display: 'swap',
  variable: '--font-maple',
})

export const metadata: Metadata = {
  title: { default: '글자월드 ADMIN', template: '%s | 글자월드 ADMIN' },
  description: '글자월드 운영 관리자 콘솔',
  // 관리자 화면은 어떤 경우에도 색인되면 안 된다.
  robots: { index: false, follow: false, nocache: true },
}

export const viewport: Viewport = {
  themeColor: '#1f2430',
  colorScheme: 'light',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="ko" className={`${pretendard.variable} ${maplestory.variable} h-full antialiased`}>
      <body className="bg-page text-ink min-h-full">{children}</body>
    </html>
  )
}
