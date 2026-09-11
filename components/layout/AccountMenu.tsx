'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { ChevronDownGlyph } from '@/components/account/mypage-icons'
import { MYPAGE_ACCOUNT_PATH } from '@/components/account/mypage-tabs'
import { UserAvatar } from '@/components/layout/UserAvatar'
import { signOut } from '@/lib/actions/auth-actions'
import { cn } from '@/lib/utils/cn'

import type { SocialProvider } from '@/lib/validation/auth'

const MENU_ID = 'header-account-menu'

/** 드롭다운 상자 — 189×124 · white · border #ebedf1 · radius 12 · shadow 0 8 20 rgba(0,20,55,.16). */
const PANEL_CLASS =
  'absolute right-0 top-[calc(100%+11px)] z-50 w-[189px] rounded-[12px] border border-[#ebedf1] ' +
  'bg-white py-2 shadow-[0_8px_20px_rgba(0,20,55,0.16)]'

/** 항목 — padding 16 · Inter Medium 16/22. */
const ITEM_CLASS =
  'font-ui focus-visible:outline-focus block w-full px-4 py-4 text-left text-[16px] leading-[22px] ' +
  'font-medium transition-colors focus-visible:-outline-offset-2 focus-visible:outline-2'

type AccountMenuProps = {
  nickname: string
  avatarUrl?: string | null
  provider?: SocialProvider | null
}

/**
 * 헤더 로그인 상태 메뉴(시안 v2 §1) — 제공자 아이콘 + 닉네임 + 삼각형.
 *
 * v1 의 어두운 알약은 사라지고 배경 없는 트리거 하나만 남았다. 누르면 "마이페이지 /
 * 로그아웃" 드롭다운이 열린다 — 로그아웃 경로가 마이페이지 사이드바에서 여기로
 * 옮겨 왔으므로(사이드바의 사용자 행 삭제) 이 메뉴가 유일한 로그아웃 입구다.
 *
 * 로그아웃은 링크(GET)가 아니라 폼(POST)이다 — 프리페치·이미지 요청만으로 세션이
 * 끊기는 CSRF 표면을 만들지 않기 위해서다.
 *
 * 접근성: Escape 로 닫고 트리거로 포커스를 되돌린다. 열면 첫 항목으로 이동하고,
 * 바깥을 누르거나 경로가 바뀌면 닫힌다.
 */
export function AccountMenu({ nickname, avatarUrl = null, provider = null }: AccountMenuProps) {
  const pathname = usePathname()
  /* 열었던 경로를 상태로 두면 라우팅 시 별도 effect 없이 자동으로 닫힌다
     (`MobileNav` 와 같은 방식). */
  const [openedPath, setOpenedPath] = useState<string | null>(null)
  const isOpen = openedPath === pathname
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const firstItemRef = useRef<HTMLAnchorElement>(null)
  const isOnMyPage =
    pathname === MYPAGE_ACCOUNT_PATH || pathname.startsWith(`${MYPAGE_ACCOUNT_PATH}/`)
  const close = () => setOpenedPath(null)

  useEffect(() => {
    if (!isOpen) return

    firstItemRef.current?.focus()

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return

      setOpenedPath(null)
      triggerRef.current?.focus()
    }

    /* pointerdown 으로 듣는다 — click 까지 기다리면 바깥 요소의 클릭이 먼저 먹혀
       "한 번 더 눌러야 닫히는" 것처럼 보인다. */
    const handlePointerDown = (event: globalThis.PointerEvent) => {
      if (containerRef.current?.contains(event.target as Node) === true) return

      setOpenedPath(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen])

  return (
    <div ref={containerRef} className="relative flex h-10 items-center">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={MENU_ID}
        onClick={() => setOpenedPath(isOpen ? null : pathname)}
        className="focus-visible:outline-focus rounded-pill flex items-center gap-1 focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <UserAvatar
          nickname={nickname}
          avatarUrl={avatarUrl}
          provider={provider}
          size="lg"
          plateless
        />
        <span className="font-ui text-ink ml-0 max-w-[160px] truncate text-[16px] leading-[22px] font-medium tracking-[-0.4px]">
          {nickname}
        </span>
        <ChevronDownGlyph
          className={cn('text-ink ml-1 h-1.5 w-3 transition-transform', isOpen ? '' : 'rotate-180')}
        />
      </button>

      {isOpen ? (
        <div id={MENU_ID} role="menu" aria-label="계정 메뉴" className={PANEL_CLASS}>
          <Link
            ref={firstItemRef}
            href={MYPAGE_ACCOUNT_PATH}
            role="menuitem"
            onClick={close}
            className={cn(
              ITEM_CLASS,
              isOnMyPage ? 'bg-[#f6f7fa] text-[#e8308a]' : 'text-ink hover:bg-[#f6f7fa]',
            )}
          >
            마이페이지
          </Link>

          <form action={signOut}>
            <button
              type="submit"
              role="menuitem"
              className={cn(ITEM_CLASS, 'text-ink hover:bg-[#f6f7fa]')}
            >
              로그아웃
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
