import Image from 'next/image'

import { MYPAGE_DIVIDER_CLASS } from '@/components/account/mypage-styles'
import { MyPageSidebar } from '@/components/account/MyPageSidebar'
import { WithdrawRow } from '@/components/account/WithdrawRow'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { SiteHeader } from '@/components/layout/SiteHeader'

import type { CurrentUser } from '@/lib/auth/current-user'
import type { ReactNode } from 'react'

const MAIN_ID = 'main-content'

/** 상단 밴드(1440×520). 아래쪽은 이미지 안에서 이미 #fafafa 로 끝난다. */
const TOP_BAND = { src: '/images/mypage/top-bg.png', height: 520 }

type MyPageShellProps = {
  /** 현재 경로. 사이드바·세그먼트 탭 활성 판정에만 쓴다. */
  activeHref: string
  user: Pick<CurrentUser, 'nickname' | 'avatarUrl' | 'provider' | 'isWithdrawn'>
  children: ReactNode
}

/**
 * 마이페이지 공용 셸 — 헤더 / 상단 밴드 / 제목 / [사이드바 268 + 콘텐츠 900] /
 * 구분선 + 회원 탈퇴 / 푸터.
 *
 * 시안 v2(1440) 좌표 — PNG 실측
 *   제목 블록 상단 334 · 본문 상단 461 · 사이드바 x120 w268 · 콘텐츠 x420 w900
 *   블록 사이 간격 32 · 회원 탈퇴 블록 하단 998 · 푸터 섹션 상단 1030
 *
 * v1 과 달리 본문이 푸터 일러스트를 덮지 않는다(겹침 175 → 0). 시안 v2 는 탈퇴
 * 블록 아래 32px 에서 푸터 섹션이 그대로 시작한다 — 그래서 음수 마진도, 배경
 * 레이어를 잘라 두는 처리도 필요 없다.
 */
export async function MyPageShell({ activeHref, user, children }: MyPageShellProps) {
  return (
    <div>
      <a
        href={`#${MAIN_ID}`}
        className="rounded-pill focus:bg-ink focus:shadow-card-hover sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-100 focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-white"
      >
        본문으로 건너뛰기
      </a>
      <SiteHeader user={user} />

      <main id={MAIN_ID} className="bg-page-sub relative isolate overflow-x-clip">
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

        <div className="relative mx-auto w-full max-w-[1200px] px-4 pt-[176px] pb-16 xl:px-0 xl:pt-[334px] xl:pb-[28px]">
          {/* 시안의 letter-spacing −3.6px 는 Figma 쪽 서체 기준값이다. Pretendard 로
              같은 렌더 폭을 얻으려면 트래킹을 0 으로 둔다(다른 서브 페이지와 동일). */}
          <h1 className="text-ink text-center text-[clamp(32px,5vw,64px)] leading-[1.17] font-semibold">
            마이페이지
          </h1>

          <div className="mt-[65px] flex flex-col items-start gap-8 xl:mt-[53px] xl:flex-row">
            <MyPageSidebar activeHref={activeHref} />

            <div className="flex w-full min-w-0 flex-col gap-8 xl:w-[900px]">
              {children}

              <hr className={MYPAGE_DIVIDER_CLASS} />
              <WithdrawRow />
            </div>
          </div>
        </div>
      </main>

      <SiteFooter variant="mypage" />
    </div>
  )
}
