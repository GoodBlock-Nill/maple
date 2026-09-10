'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { Logo } from '@/components/layout/Logo'
import { isNavItemHidden, matchesPath } from '@/components/layout/navigation'
import { UserAvatar } from '@/components/layout/UserAvatar'
import { useFocusTrap } from '@/components/layout/use-focus-trap'
import { Button } from '@/components/ui/Button'
import { CloseIcon, MenuIcon } from '@/components/ui/icons'
import { signOut } from '@/lib/actions/auth-actions'
import { DISCORD_URL, NAV_ITEMS, PLAY_URL } from '@/lib/constants/site'
import { cn } from '@/lib/utils/cn'
import { RESTORE_PATH } from '@/lib/validation/auth'

import type { SocialProvider } from '@/lib/validation/auth'

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
  user?: {
    nickname: string
    avatarUrl?: string | null
    provider?: SocialProvider | null
    /** 탈퇴 대기 계정. "내 정보" 대신 "계정 복구"로 안내한다. */
    isWithdrawn?: boolean
  } | null
}

// 포털 대상은 바뀌지 않으므로 구독할 것이 없다. 서버 스냅샷은 null 로 두어 SSR 마크업과
// 첫 클라이언트 렌더를 일치시킨다(하이드레이션 후 body 로 채워진다).
const subscribeNever = () => () => {}
const getBody = () => document.body
const getServerBody = () => null

const USER_ROW_CLASS =
  'rounded-card text-ink-muted block px-2 py-2.5 text-left text-[15px] transition-colors ' +
  'hover:bg-sheet hover:text-ink'

export function MobileNav({ className, user = null }: MobileNavProps) {
  const pathname = usePathname()
  // 열었던 경로를 상태로 두면 라우팅 시 별도 effect 없이 자동으로 닫힌다.
  const [openedPath, setOpenedPath] = useState<string | null>(null)
  const isOpen = openedPath === pathname
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  /* 오버레이·패널은 body 로 포털한다. 헤더(.glass)의 backdrop-filter 가 fixed 자손의
     containing block 이 되어, 헤더 안에 두면 드로어가 헤더 높이(74px)로 잘린다.
     (모든 기기에서 "드로어가 올바르게 표시되지 않음" 으로 보고된 원인.) */
  const portalTarget = useSyncExternalStore(subscribeNever, getBody, getServerBody)

  useFocusTrap(panelRef, isOpen)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') setOpenedPath(null)
    }

    /* iOS Safari 는 body overflow:hidden 만으로는 뒤 페이지 스크롤이 막히지 않는다.
       body 를 현재 스크롤 위치에 고정(position:fixed)하고 닫을 때 원위치로 되돌린다. */
    const scrollY = window.scrollY
    const { position, top, width, overflow } = document.body.style
    Object.assign(document.body.style, {
      position: 'fixed',
      top: `-${scrollY}px`,
      width: '100%',
      overflow: 'hidden',
    })
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      Object.assign(document.body.style, { position, top, width, overflow })
      window.scrollTo(0, scrollY)
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

  const drawer = (
    <>
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
          'shadow-sheet transition-[transform,visibility] duration-300 ease-out',
          // 닫힌 상태에서는 화면 밖으로 완전히 나가 있으므로 탭을 가로채지 않는다.
          isOpen ? 'translate-x-0' : 'invisible translate-x-full',
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

        {/* 로그인 상태에서만 노출한다. "내 정보"·"로그아웃"은 여기 한 곳뿐이다
            (헤더 데스크톱 드롭다운과 대응). */}
        {user === null ? null : (
          <div className="border-line flex flex-col gap-2 border-b px-4 py-4">
            <div className="flex items-center gap-2.5 px-2">
              <UserAvatar
                nickname={user.nickname}
                avatarUrl={user.avatarUrl}
                provider={user.provider}
                size="md"
              />
              <span className="text-ink truncate text-[17px] font-semibold">{user.nickname}</span>
            </div>

            {user.isWithdrawn === true ? (
              <Link href={RESTORE_PATH} onClick={close} className={USER_ROW_CLASS}>
                계정 복구
              </Link>
            ) : (
              <Link href="/account" onClick={close} className={USER_ROW_CLASS}>
                내 정보
              </Link>
            )}
            <form action={signOut}>
              <button type="submit" className={cn(USER_ROW_CLASS, 'w-full')}>
                로그아웃
              </button>
            </form>
          </div>
        )}

        <nav aria-label="모바일 메뉴" className="flex-1 overflow-y-auto px-4 py-5">
          <ul className="flex flex-col gap-1">
            {NAV_ITEMS.filter((item) => !isNavItemHidden(item.href)).map((item) => {
              const isActive = matchesPath(item.href, pathname)

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive ? 'page' : undefined}
                    /* 현재 페이지 링크는 경로가 바뀌지 않아 자동으로 닫히지 않으므로 직접 닫는다. */
                    onClick={close}
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
          {/* 로그인 수단이 간편로그인뿐이라 가입과 로그인이 같은 동작이다 — 헤더
              (AuthMenu)와 같은 버튼 하나만 드로어 아래쪽에 둔다.
              로그인 상태의 "내 정보"·"로그아웃"은 드로어 상단(사용자 블록)에 이미 있다. */}
          {user === null ? (
            <Button href="/login" variant="light" size="md" className="w-full font-medium">
              로그인
            </Button>
          ) : null}
        </div>
      </div>
    </>
  )

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

      {portalTarget === null ? null : createPortal(drawer, portalTarget)}
    </div>
  )
}
