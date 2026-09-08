import { AuthMenu } from '@/components/layout/AuthMenu'
import { Logo } from '@/components/layout/Logo'
import { MobileNav } from '@/components/layout/MobileNav'
import { SiteNav } from '@/components/layout/SiteNav'
import { Button } from '@/components/ui/Button'

type SiteHeaderProps = {
  /** 세션 연동 전까지는 항상 null. */
  user?: { nickname: string } | null
}

/**
 * 배경 일러스트 위에 떠 있는 글래스 바.
 * 높이 0짜리 sticky 래퍼를 써서 히어로를 밀어내지 않으면서 상단에 고정된다.
 */
export function SiteHeader({ user = null }: SiteHeaderProps) {
  return (
    <div className="pointer-events-none sticky top-5 z-50 flex h-0 items-start justify-center px-4">
      <header
        className={
          'glass pointer-events-auto flex w-full max-w-[1140px] items-center gap-4 ' +
          'rounded-bar px-5 py-[15px] lg:w-auto lg:max-w-none lg:gap-[53px]'
        }
      >
        <Logo />
        <SiteNav id="site-desktop-nav" className="hidden lg:block" />
        <AuthMenu user={user} id="site-desktop-auth" className="ml-auto hidden lg:flex" />
        <div className="ml-auto flex items-center gap-2 lg:hidden">
          <Button href="/register" variant="dark" size="sm">
            회원가입
          </Button>
          <MobileNav />
        </div>
      </header>
    </div>
  )
}
