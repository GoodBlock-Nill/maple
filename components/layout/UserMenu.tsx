'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

import { UserAvatar } from '@/components/layout/UserAvatar'
import { ChevronDownIcon } from '@/components/ui/icons'
import { signOut } from '@/lib/actions/auth-actions'
import { cn } from '@/lib/utils/cn'

import type { SocialProvider } from '@/lib/validation/auth'

type UserMenuProps = {
  nickname: string
  /** 프로필 아바타. 대부분 없으므로(스텁 로그인은 채우지 않는다) 첫 글자/제공자 마크로 폴백한다. */
  avatarUrl?: string | null
  /** 간편로그인 제공자 — 아바타에 구글/카카오/네이버 마크를 그리는 데 쓴다. */
  provider?: SocialProvider | null
  id?: string
  className?: string
}

const ITEM_COUNT = 2

const TRIGGER_CLASS =
  'inline-flex h-10 items-center gap-2 rounded-bar px-2 outline-none transition-colors ' +
  'hover:bg-ink/5 focus-visible:ring-focus/60 focus-visible:ring-2 focus-visible:ring-offset-2'

const MENU_CLASS =
  'shadow-menu absolute top-[calc(100%+8px)] right-0 z-30 flex w-[160px] origin-top-right ' +
  'flex-col gap-0.5 rounded-[12px] border border-line-soft bg-white p-2 ' +
  'transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none ' +
  'starting:scale-95 starting:opacity-0'

const ITEM_CLASS =
  'flex h-10 items-center rounded-lg px-3 text-[15px] transition-colors outline-none ' +
  'hover:bg-sheet focus-visible:bg-sheet'

/**
 * 헤더/드로어의 로그인 사용자 메뉴 — 닉네임 트리거 → "내 정보"/"로그아웃" 드롭다운.
 *
 * `components/board/LinkMenu.tsx` 의 열기·닫기·포커스 패턴(외부 클릭, Escape,
 * 화살표 키 순환, `starting:` 페이드/스케일)을 그대로 가져오되 역할은 다르게
 * 준다. LinkMenu 는 "선택"(listbox/option)이지만 여기는 "동작"(내비게이션 +
 * 폼 제출)이라 ARIA APG 의 메뉴 패턴(`menu`/`menuitem`)을 쓴다. 로그아웃은
 * GET 링크가 아니라 POST 폼이어야 해서(CSRF — LogoutButton과 같은 이유) 이
 * 컴포넌트만의 새 구현으로 둔다.
 */
export function UserMenu({
  nickname,
  avatarUrl = null,
  provider = null,
  id,
  className,
}: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLElement | null)[]>([])

  useEffect(() => {
    if (!isOpen) return

    const handlePointerDown = (event: globalThis.MouseEvent) => {
      if (!(event.target instanceof Node)) return
      if (rootRef.current?.contains(event.target)) return
      setIsOpen(false)
    }

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setIsOpen(false)
      triggerRef.current?.focus()
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    itemRefs.current[activeIndex]?.focus()
  }, [isOpen, activeIndex])

  const openMenu = () => {
    setActiveIndex(0)
    setIsOpen(true)
  }

  const focusItem = (index: number) => {
    setActiveIndex(index)
    itemRefs.current[index]?.focus()
  }

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const lastIndex = ITEM_COUNT - 1

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        return focusItem(activeIndex >= lastIndex ? 0 : activeIndex + 1)
      case 'ArrowUp':
        event.preventDefault()
        return focusItem(activeIndex <= 0 ? lastIndex : activeIndex - 1)
      case 'Home':
        event.preventDefault()
        return focusItem(0)
      case 'End':
        event.preventDefault()
        return focusItem(lastIndex)
      default:
        return
    }
  }

  return (
    <div ref={rootRef} id={id} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        className={TRIGGER_CLASS}
      >
        <UserAvatar nickname={nickname} avatarUrl={avatarUrl} provider={provider} size="sm" />
        <span className="text-ink max-w-[140px] truncate text-[16px] font-semibold">
          {nickname}
        </span>
        <ChevronDownIcon
          className={cn(
            'text-ink-muted size-3 shrink-0 transition-transform duration-150',
            isOpen && 'rotate-180',
          )}
        />
      </button>

      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label={`${nickname} 메뉴`}
          onKeyDown={handleListKeyDown}
          className={MENU_CLASS}
        >
          <Link
            ref={(node) => {
              itemRefs.current[0] = node
            }}
            href="/account"
            role="menuitem"
            tabIndex={activeIndex === 0 ? 0 : -1}
            onClick={() => setIsOpen(false)}
            className={cn(ITEM_CLASS, 'text-ink font-medium')}
          >
            내 정보
          </Link>

          <form action={signOut}>
            <button
              ref={(node) => {
                itemRefs.current[1] = node
              }}
              type="submit"
              role="menuitem"
              tabIndex={activeIndex === 1 ? 0 : -1}
              className={cn(ITEM_CLASS, 'text-ink-muted w-full text-left')}
            >
              로그아웃
            </button>
          </form>
        </div>
      ) : null}
    </div>
  )
}
