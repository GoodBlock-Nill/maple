import Image from 'next/image'

import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'
import { getCurrentUser } from '@/lib/auth/current-user'

import type { CSSProperties, ReactNode } from 'react'

const MAIN_ID = 'main-content'

/** 하늘 배경 두 종류. 회원가입은 카드가 길어 지평선 광채가 144px 아래에 있다. */
const SKY = {
  login: { src: '/images/auth/login-sky.png', width: 1440, height: 1400 },
  signup: { src: '/images/auth/signup-sky.png', width: 1440, height: 1380 },
} as const

export type AuthSky = keyof typeof SKY

type AuthSceneProps = {
  sky: AuthSky
  /**
   * 1440 기준 본문 섹션 높이 = 푸터 섹션이 시작하는 y.
   *
   * 시안은 카드 아래쪽이 푸터 배경(위쪽 107px 이 하늘)과 10px 남짓 겹친다.
   * 카드 높이에 맡기면 오차가 그대로 푸터 위치로 옮겨 가므로 xl 이상에서는
   * 시안 실측값으로 고정한다(카드가 더 길어져도 잘리지 않고 넘칠 뿐이다).
   * 값을 주지 않으면 카드 높이에 맞춰 늘어난다.
   */
  sceneHeight?: number
  children: ReactNode
}

/**
 * 로그인·회원가입 화면 셸 — 헤더 / 우주 배경 + UFO / 카드 / 달 표면 푸터.
 *
 * 시안(Figma 2041:2289 · 2041:2365)의 1440 좌표를 그대로 재현한다.
 *  - 카드 상단 y=223 (`xl:pt-[223px]`)
 *  - UFO (141,156) 255×151 — 하늘 이미지와 같은 비율의 상자 안에 % 로 배치해
 *    폭이 줄어도 배경과 함께 축소된다.
 *  - 푸터 섹션 상단 y=1194(로그인) / 1338(회원가입)
 *
 * 온보딩·복구 화면(`/auth/*`)은 기존 `AuthShell` 을 계속 쓴다 — 그 화면들의
 * 시안이 따로 없어서 이 배경을 얹으면 근거 없는 화면이 된다.
 */
export async function AuthScene({ sky, sceneHeight, children }: AuthSceneProps) {
  const user = await getCurrentUser()
  const background = SKY[sky]
  const style =
    sceneHeight === undefined
      ? undefined
      : ({ '--auth-scene-h': `${sceneHeight}px` } as CSSProperties)

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
        style={style}
        className="relative isolate flex-1 overflow-clip bg-[#0b1642]"
      >
        {/* 우주 배경. 1440 이상에서는 시안대로 폭 100% · 높이 자동이고,
            그보다 좁으면 섹션을 가득 채워(가로 크롭) 카드 아래가 비지 않게 한다. */}
        <Image
          src={background.src}
          alt=""
          width={background.width}
          height={background.height}
          priority
          sizes="100vw"
          aria-hidden
          className="absolute top-0 left-0 -z-10 h-full w-full max-w-none object-cover object-top xl:h-auto"
        />

        {/* UFO 는 카드 왼쪽 위 모서리를 덮는다(시안 동일). 하늘과 같은 비율의
            상자 안에 % 로 두어 어느 폭에서도 배경 위 같은 자리에 앉는다. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 z-20 aspect-[1440/1400]"
        >
          <Image
            src="/images/auth/chars/ufo.gif"
            alt=""
            width={190}
            height={113}
            unoptimized
            priority
            className="pixel-art drop-shadow-mascot absolute top-[86px] left-4 w-[120px] max-w-none sm:top-[11.142857%] sm:left-[9.791667%] sm:w-[17.708333%]"
          />
        </div>

        <div className="mx-auto flex w-full max-w-[1440px] items-start justify-center px-4 pt-[110px] pb-14 sm:pt-[150px] xl:h-[var(--auth-scene-h,auto)] xl:px-0 xl:pt-[223px] xl:pb-0">
          {children}
        </div>
      </main>

      <SiteFooter variant="auth" />
    </>
  )
}
