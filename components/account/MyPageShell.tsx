import Image from 'next/image'

import { MYPAGE_DIVIDER_CLASS, MYPAGE_FOOTER_OVERLAP } from '@/components/account/mypage-styles'
import { MyPageSidebar } from '@/components/account/MyPageSidebar'
import { WithdrawBlock } from '@/components/account/WithdrawBlock'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'

import type { CurrentUser } from '@/lib/auth/current-user'
import type { CSSProperties, ReactNode } from 'react'

const MAIN_ID = 'main-content'

/** 상단 밴드(1440×520). 아래쪽은 이미지 안에서 이미 #fafafa 로 끝난다. */
const TOP_BAND = { src: '/images/mypage/top-bg.png', height: 520 }

type MyPageShellProps = {
  /** 현재 경로. 사이드바 활성 탭 판정에만 쓴다. */
  activeHref: string
  user: Pick<CurrentUser, 'nickname' | 'avatarUrl' | 'provider' | 'isWithdrawn'>
  children: ReactNode
}

/**
 * 마이페이지 공용 셸 — 헤더 / 상단 밴드 / 제목 / [사이드바 268 + 콘텐츠 900] /
 * 구분선 + 회원 탈퇴 / 푸터.
 *
 * 시안(1440) 좌표
 *   제목 블록 상단 334(다른 서브 페이지와 동일) · 본문 상단 463
 *   사이드바 x120 w268 · 콘텐츠 x420 w900
 *   푸터 배경 상단 = 마지막 카드 아래 −32
 *
 * 마지막 줄이 이 셸의 유일한 특이점이다. 시안은 푸터 일러스트(939)의 위쪽
 * 175px 을 본문이 덮는다 — 구분선과 회원 탈퇴 블록이 그 위에 얹혀 있고, 배경
 * 그림의 그 구간은 #fafafa 로 구워져 있어 이음매가 보이지 않는다. 그래서
 *   · 본문 배경(#fafafa)은 175px 못 미쳐서 끝내고
 *   · 푸터는 음수 마진으로 그만큼 끌어올리며
 *   · 본문을 z-10 로 올려 겹치는 구간이 푸터 위에 그려지게 한다.
 * 1280 미만에서는 겹침 없이 순서대로 흐른다(시안이 없는 폭이라 안전한 쪽).
 */
export async function MyPageShell({ activeHref, user, children }: MyPageShellProps) {
  const style = { '--mypage-overlap': `${MYPAGE_FOOTER_OVERLAP}px` } as CSSProperties

  return (
    <div style={style}>
      <a
        href={`#${MAIN_ID}`}
        className="rounded-pill focus:bg-ink focus:shadow-card-hover sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        본문으로 건너뛰기
      </a>
      <SiteHeader user={user} />

      <main id={MAIN_ID} className="relative isolate z-10 overflow-x-clip">
        {/* 바탕색은 별도 레이어가 칠한다. xl 이상에서는 푸터와 겹치는 175px 을
            남겨 두어야 그 구간에서 언덕 일러스트가 그대로 보인다. */}
        <div
          aria-hidden
          className="bg-page-sub absolute inset-x-0 top-0 bottom-0 -z-20 xl:bottom-[var(--mypage-overlap)]"
        />
        <Image
          src={TOP_BAND.src}
          alt=""
          width={1440}
          height={TOP_BAND.height}
          priority
          sizes="100vw"
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] w-full max-w-none object-cover object-top"
        />

        <div className="relative mx-auto w-full max-w-[1200px] px-4 pt-[190px] xl:px-0 xl:pt-[334px]">
          {/* 시안의 letter-spacing −3.6px 는 Figma 쪽 서체 기준값이다. Pretendard 로
              같은 렌더 폭을 얻으려면 트래킹을 0 으로 둔다(다른 서브 페이지와 동일). */}
          <h1 className="text-ink text-center text-[clamp(36px,5vw,64px)] leading-[1.17] font-semibold">
            마이페이지
          </h1>

          <div className="mt-10 flex flex-col items-start gap-8 xl:mt-[53px] xl:flex-row">
            <MyPageSidebar
              activeHref={activeHref}
              nickname={user.nickname}
              avatarUrl={user.avatarUrl}
            />

            <div className="flex w-full flex-col gap-8 xl:w-[900px]">
              {children}

              <hr className={MYPAGE_DIVIDER_CLASS} />
              <WithdrawBlock />
            </div>
          </div>

          {/* 폰·태블릿에서는 겹침이 없으므로 푸터와 붙지 않도록 여백을 둔다. */}
          <div className="h-16 xl:h-0" />
        </div>
      </main>

      <div className="relative z-0 xl:-mt-[var(--mypage-overlap)]">
        <SiteFooter variant="mypage" />
      </div>
    </div>
  )
}
