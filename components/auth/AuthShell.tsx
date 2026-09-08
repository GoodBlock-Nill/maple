import { SiteHeader } from '@/components/layout/SiteHeader'
import { getCurrentUser } from '@/lib/auth/current-user'
import { SITE_NAME } from '@/lib/constants/site'

import type { ReactNode } from 'react'

const MAIN_ID = 'main-content'

/**
 * 인증 화면 셸.
 *
 * 서브 페이지 셸(`PageShell`)은 페이지별 배경 밴드·마스코트 자산을 전제하지만
 * 로그인/온보딩에는 해당 자산이 없다. 그래서 같은 토큰(글래스 표면·라운드)만
 * 공유하는 가벼운 전용 셸을 쓴다. 푸터도 생략해 카드에 시선을 모은다.
 *
 * 라우트 그룹 `(auth)`(/login·/register)와 실제 세그먼트 `/auth`(/auth/onboarding)는
 * 서로 다른 레이아웃 트리에 있어서 레이아웃 파일을 공유할 수 없다. 그래서 껍데기를
 * 컴포넌트로 빼 두 레이아웃이 함께 쓴다.
 */
export async function AuthShell({ children }: { children: ReactNode }) {
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

      <main id={MAIN_ID} className="bg-page-sub relative isolate flex-1 overflow-x-clip">
        {/* 헤더 뒤까지 올라오는 상단 밴드. 자산이 없어도 그라데이션만으로 성립한다. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[320px]"
          style={{ backgroundImage: 'linear-gradient(180deg, #cfe6ff 0%, #f3f3f3 100%)' }}
        />

        <div className="mx-auto flex w-full max-w-[520px] flex-col items-center px-4 pt-[150px] pb-24">
          {children}
        </div>
      </main>

      <p className="text-ink-muted bg-page-sub pb-10 text-center text-[13px]">
        © {SITE_NAME}. All rights reserved.
      </p>
    </>
  )
}
