import { AuthMenu, AUTH_PILL_LIGHT_CLASS } from '@/components/layout/AuthMenu'
import { HeaderGlass } from '@/components/layout/HeaderGlass'
import { Logo } from '@/components/layout/Logo'
import { MobileNav } from '@/components/layout/MobileNav'
import { SiteNav } from '@/components/layout/SiteNav'
import { Button } from '@/components/ui/Button'

import type { SocialProvider } from '@/lib/validation/auth'

type SiteHeaderProps = {
  /** 서버에서 `getCurrentUser()` 로 주입한다. 미로그인이면 null. */
  user?: {
    nickname: string
    avatarUrl?: string | null
    provider?: SocialProvider | null
    isWithdrawn?: boolean
  } | null
}

/**
 * 배경 일러스트 위에 떠 있는 글래스 바.
 * 높이 0짜리 sticky 래퍼를 써서 히어로를 밀어내지 않으면서 상단에 고정된다.
 * 유리 표면의 스크롤 반응은 HeaderGlass(클라이언트 컴포넌트)가 담당하므로
 * 이 컴포넌트 자체는 서버 컴포넌트로 남는다.
 */
export function SiteHeader({ user = null }: SiteHeaderProps) {
  return (
    <div className="pointer-events-none sticky top-5 z-50 flex h-0 items-start justify-center px-4">
      <HeaderGlass className="rounded-bar flex w-full max-w-[1140px] items-center gap-4 px-5 py-[15px] lg:w-auto lg:max-w-none lg:gap-[53px]">
        <Logo />
        <SiteNav id="site-desktop-nav" className="hidden lg:block" />
        <AuthMenu user={user} id="site-desktop-auth" className="ml-auto hidden lg:flex" />
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          {/* 미로그인일 때만 노출한다. 로그인 상태의 로그아웃은 드로어 안에 있다.
              시안(auth-v2 모바일)의 알약은 데스크톱과 같은 흰 알약이다. */}
          {user === null ? (
            <Button href="/login" variant="light" size="sm" className={AUTH_PILL_LIGHT_CLASS}>
              로그인
            </Button>
          ) : null}
          <MobileNav user={user} />
        </div>
      </HeaderGlass>
    </div>
  )
}
