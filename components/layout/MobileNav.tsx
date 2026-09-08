'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { LogoutButton } from '@/components/auth/LogoutButton'
import { Logo } from '@/components/layout/Logo'
import { matchesPath } from '@/components/layout/navigation'
import { useFocusTrap } from '@/components/layout/use-focus-trap'
import { Button } from '@/components/ui/Button'
import { CloseIcon, MenuIcon } from '@/components/ui/icons'
import { DISCORD_URL, NAV_ITEMS, PLAY_URL } from '@/lib/constants/site'
import { cn } from '@/lib/utils/cn'

const PANEL_ID = 'mobile-nav-panel'

// 열려 있는 동안 배경(본문/헤더 데스크톱 컨트롤)을 inert 처리하기 위한 대상 id.
// SiteHeader/SiteNav/AuthMenu 쪽에 동일한 id 로 부여되어 있다.
const INERT_TARGET_IDS = ['main-content', 'site-desktop-nav', 'site-desktop-auth']

const ICON_BUTTON_CLASS =
  'inline-flex size-11 items-center justify-center rounded-bar text-ink transition-colors ' +
  'hover:bg-ink/8 focus-visible:outline-2 focus-visible:outline-offset-2'

type MobileNavProps = {
  className?: string
  /** 서버에서 `getCurrentUser()` 로 주입한다. 미로그인이면 null. */
  user?: { nickname: string } | null
}

export function MobileNav({ className, user = null }: MobileNavProps) {
  const pathname = usePathname()
  // 열었던 경로를 상태로 두면 라우팅 시 별도 effect 없이 자동으로 닫힌다.
  const [openedPath, setOpenedPath] = useState<string | null>(null)
  const isOpen = openedPath === pathname
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  useFocusTrap(panelRef, isOpen)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpenedPath(null)
    }

    const { overflow } = document.body.style
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = overflow
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  // 배경 콘텐츠(본문/헤더 데스크톱 내비)가 열려 있는 동안 포커스·스크린리더 접근에서
  // 제외되도록 inert 처리한다. 대상이 없으면(다른 레이아웃 등) 조용히 무시한다.
  useEffect(() => {
    if (!isOpen) return

    const targets = INERT_TARGET_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    )

    targets.forEach((el) => {
      el.inert = true
      el.setAttribute('aria-hidden', 'true')
    })

    return () => {
      targets.forEach((el) => {
        el.inert = false
        el.removeAttribute('aria-hidden')
      })
    }
  }, [isOpen])

  const close = () => setOpenedPath(null)

  return (
    <div className={className}>
      <button
        ref={triggerRef}
        type="button"
        aria-label="메뉴 열기"
        aria-expanded={isOpen}
        aria-controls={PANEL_ID}
        onClick={() => setOpenedPath(pathname)}
        className={cn(ICON_BUTTON_CLASS, '-mr-1.5')}
      >
        <MenuIcon />
      </button>

      <div
        aria-hidden={!isOpen}
        onClick={close}
        className={cn(
          'bg-ink/45 fixed inset-0 z-60 backdrop-blur-sm transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      <div
        ref={panelRef}
        id={PANEL_ID}
        role="dialog"
        aria-modal={isOpen || undefined}
        aria-label="모바일 메뉴"
        inert={!isOpen}
        className={cn(
          'fixed inset-y-0 right-0 z-70 flex w-[86%] max-w-sm flex-col bg-white',
          'shadow-sheet transition-transform duration-300 ease-out',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        <div className="border-line flex items-center justify-between border-b px-5 py-4">
          <Logo width={89} height={32} />
          <button
            type="button"
            aria-label="메뉴 닫기"
            onClick={close}
            className={cn(ICON_BUTTON_CLASS, '-mr-2')}
          >
            <CloseIcon />
          </button>
        </div>

        <nav aria-label="모바일 메뉴" className="flex-1 overflow-y-auto px-4 py-5">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => {
              const isActive = matchesPath(item.href, pathname)

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'rounded-card block px-3 py-3 text-[17px] font-semibold transition-colors',
                      isActive
                        ? 'bg-sheet text-ink'
                        : 'text-ink-muted hover:bg-sheet hover:text-ink',
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        <div className="border-line flex flex-col gap-2 border-t p-4">
          <Button href={PLAY_URL} prefetch={false} variant="dark" size="md" className="w-full">
            메이플월드 바로가기
          </Button>
          <Button
            href={DISCORD_URL}
            prefetch={false}
            variant="discord"
            size="md"
            className="w-full"
          >
            디스코드 바로가기
          </Button>
          {/* 간편로그인에는 가입/로그인 구분이 없어 버튼 하나만 둔다(제품 결정 2026-09-08). */}
          {user === null ? (
            <Button href="/login" variant="dark" size="md" className="w-full">
              로그인
            </Button>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-ink-muted truncate text-[15px]">
                <strong className="text-ink font-semibold">{user.nickname}</strong>님
              </span>
              <LogoutButton />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
