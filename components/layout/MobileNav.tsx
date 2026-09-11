'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'

import { MobileNavPanel } from '@/components/layout/MobileNavPanel'
import { useFocusTrap } from '@/components/layout/use-focus-trap'
import { MenuIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils/cn'

import type { SocialProvider } from '@/lib/validation/auth'

const PANEL_ID = 'mobile-nav-panel'

// 열려 있는 동안 배경(본문/헤더 데스크톱 컨트롤)을 inert 처리하기 위한 대상 id.
// SiteHeader/SiteNav/AuthMenu 쪽에 동일한 id 로 부여되어 있다.
const INERT_TARGET_IDS = ['main-content', 'site-desktop-nav', 'site-desktop-auth']

const ICON_BUTTON_CLASS =
  'inline-flex size-11 items-center justify-center rounded-bar text-ink transition-colors ' +
  'hover:bg-ink/8 focus-visible:outline-2 focus-visible:outline-offset-2'

export type MobileNavUser = {
  nickname: string
  avatarUrl?: string | null
  provider?: SocialProvider | null
  /** 탈퇴 대기 계정. "내 정보" 대신 "계정 복구"로 안내한다. */
  isWithdrawn?: boolean
}

type MobileNavProps = {
  className?: string
  /** 서버에서 `getCurrentUser()` 로 주입한다. 미로그인이면 null. */
  user?: MobileNavUser | null
}

// 포털 대상은 바뀌지 않으므로 구독할 것이 없다. 서버 스냅샷은 null 로 두어 SSR 마크업과
// 첫 클라이언트 렌더를 일치시킨다(하이드레이션 후 body 로 채워진다).
const subscribeNever = () => () => {}
const getBody = () => document.body
const getServerBody = () => null

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
          // 시안 v2 §드로어 골격: 375 기준 폭 290. 아주 좁은 폰에서도 잘리지 않게 vw 상한을 둔다.
          'fixed inset-y-0 right-0 z-70 flex w-[290px] max-w-[86vw] flex-col bg-white',
          'shadow-sheet transition-[transform,visibility] duration-300 ease-out',
          // 닫힌 상태에서는 화면 밖으로 완전히 나가 있으므로 탭을 가로채지 않는다.
          isOpen ? 'translate-x-0' : 'invisible translate-x-full',
        )}
      >
        <MobileNavPanel pathname={pathname} user={user} isOpen={isOpen} close={close} />
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
