import { LoginCharacters } from '@/components/auth/LoginCharacters'
import { LoginForm } from '@/components/auth/LoginForm'
import { LOGIN_STAGE_HEIGHT } from '@/components/auth/login-characters'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { getCurrentUser } from '@/lib/auth/current-user'
import { loginErrorMessage } from '@/lib/auth/login-error'
import { firstValue } from '@/lib/utils/list-query'
import { sanitizeNextPath } from '@/lib/validation/auth'

import type { Metadata } from 'next'
import type { CSSProperties } from 'react'

export const metadata: Metadata = {
  title: '로그인',
  description: '간편하게 로그인하고 글자월드를 시작해보세요.',
  robots: { index: false, follow: false },
}

const MAIN_ID = 'main-content'

const SUBTITLE = '간편하게 로그인하고 글자월드를 시작해보세요.'

/**
 * 로그인 화면(시안 auth-v2, Figma 2UmKcpmy55IqMZ7Sg6vTeW 5:5018).
 *
 * 1440 기준 실측값을 그대로 박는다.
 *  - 페이지 배경 #f6f7fa, 본문 섹션 높이 868(= 푸터가 시작하는 y, 프레임 1456)
 *  - 본문 블록 (508,300) 폭 424 — 제목 28 / 부제 16 / 버튼 400×54 두 개
 *  - 좌우 캐릭터는 lg 이상에서만 보인다(폰 시안에는 없다)
 *
 * 푸터는 홈과 같은 변형(`home`, 588)이다 — 시안이 홈 푸터를 그대로 얹었다.
 * `(auth)` 레이아웃은 껍데기라 헤더·푸터를 이 페이지가 직접 그린다.
 */
export default async function LoginPage(props: PageProps<'/login'>) {
  const searchParams = await props.searchParams
  const nextPath = sanitizeNextPath(firstValue(searchParams.next))
  const initialError = loginErrorMessage(firstValue(searchParams.error))
  const user = await getCurrentUser()

  return (
    <>
      <a
        href={`#${MAIN_ID}`}
        className="rounded-pill focus:bg-ink focus:shadow-card-hover sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        본문으로 건너뛰기
      </a>
      <SiteHeader user={user} />

      <main
        id={MAIN_ID}
        style={{ '--login-main-h': `${LOGIN_STAGE_HEIGHT}px` } as CSSProperties}
        className="relative isolate overflow-x-clip bg-[#f6f7fa] pb-24 lg:min-h-[var(--login-main-h)] lg:pb-0"
      >
        <LoginCharacters />

        <div className="font-ui relative mx-auto flex w-full max-w-[375px] flex-col items-center px-4 pt-[196px] md:max-w-[424px] md:px-0 md:pt-[300px]">
          <h1 className="text-center text-[20px] leading-[28px] font-medium tracking-[-0.5px] text-[#2a2a2a] md:text-[28px] md:leading-[40px] md:tracking-[-0.7px]">
            로그인
          </h1>

          {/* 제목 아래 12, 버튼까지 48 — 시안의 세로 리듬은 폰에서도 같다. */}
          <p className="mt-3 text-center text-[15px] leading-[22px] font-medium tracking-[-0.4px] text-[#727272] md:text-[16px]">
            {SUBTITLE}
          </p>

          <div className="mt-12 w-full">
            <LoginForm nextPath={nextPath} initialError={initialError} />
          </div>
        </div>
      </main>

      <SiteFooter variant="home" />
    </>
  )
}
