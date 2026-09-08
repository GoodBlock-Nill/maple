'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, useTransition } from 'react'

import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

export type LinkMenuItem = {
  label: string
  href: string
  isActive: boolean
}

type LinkMenuProps = {
  /** 트리거 버튼의 접근성 이름(예: "목록 보기 방식"). */
  label: string
  trigger: ReactNode
  items: readonly LinkMenuItem[]
  triggerClassName?: string
  menuClassName?: string
  className?: string
}

/** 체크 표시 — 선택된 옵션 앞에 붙는다. currentColor 라 텍스트 색을 그대로 물려받는다. */
function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" aria-hidden className={className}>
      <path d="M3.5 8.5L6.5 11.5L12.5 4.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const TRIGGER_CLASS =
  'tap-area group inline-flex items-center gap-1 rounded-md outline-none transition-opacity duration-150 motion-reduce:transition-none hover:text-ink focus-visible:ring-focus/60 focus-visible:ring-2 focus-visible:ring-offset-2 data-[pending]:cursor-wait data-[pending]:opacity-60'

const MENU_CLASS =
  'shadow-menu absolute top-[calc(100%+8px)] right-0 z-30 min-w-[140px] max-w-[calc(100vw-1.5rem)] flex origin-top-left flex-col gap-0.5 rounded-[12px] border border-line-soft bg-white p-2 transition-[opacity,transform] duration-150 ease-out motion-reduce:transition-none starting:scale-95 starting:opacity-0'

const ITEM_CLASS =
  'flex h-10 items-center gap-2 rounded-lg px-3 text-ui whitespace-nowrap transition-colors outline-none hover:bg-sheet focus-visible:bg-sheet'

/**
 * URL 링크로 이동하는 드롭다운. 목록 필터는 전부 searchParams 로 표현하므로 항목은
 * 실제 `<Link>` 다(우클릭 새 탭, 프리페치, JS 없는 폴백 유지). 선택은 `onNavigate` 로
 * 기본 내비게이션을 가로채 `useTransition` 으로 감싼 `router.push` 로 대신한다 — 메뉴가
 * (=Link 가) 즉시 닫혀도 트리거가 대기 상태를 계속 알아야 하기 때문에, Link 에 매인
 * `useLinkStatus` 대신 이 컴포넌트 스코프의 트랜지션 하나로 처리한다.
 */
export function LinkMenu({
  label,
  trigger,
  items,
  triggerClassName,
  menuClassName,
  className,
}: LinkMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([])

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

  // activeIndex 는 openMenu 에서 이벤트 핸들러 중에 동기적으로 정해 둔다(이펙트 안에서
  // setState 를 하면 불필요한 추가 렌더가 생긴다). 이펙트는 DOM 포커스 이동만 담당한다.
  useEffect(() => {
    if (!isOpen) return
    itemRefs.current[activeIndex]?.focus()
  }, [isOpen, activeIndex])

  const openMenu = () => {
    const activeItemIndex = items.findIndex((item) => item.isActive)
    setActiveIndex(activeItemIndex >= 0 ? activeItemIndex : 0)
    setIsOpen(true)
  }

  const focusItem = (index: number) => {
    setActiveIndex(index)
    itemRefs.current[index]?.focus()
  }

  const handleListKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const lastIndex = items.length - 1
    if (lastIndex < 0) return

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
      case ' ':
        // 앵커는 스페이스로 활성화되지 않는다(엔터만 네이티브 동작). 버튼처럼 보강한다.
        event.preventDefault()
        return itemRefs.current[activeIndex]?.click()
      default:
        return
    }
  }

  const selectItem = (href: string) => {
    setIsOpen(false)
    startTransition(() => router.push(href))
  }

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        aria-busy={isPending || undefined}
        data-state={isOpen ? 'open' : 'closed'}
        data-pending={isPending ? '' : undefined}
        onClick={() => (isOpen ? setIsOpen(false) : openMenu())}
        className={cn(TRIGGER_CLASS, triggerClassName)}
      >
        {trigger}
      </button>

      {isOpen ? (
        <div
          id={menuId}
          role="listbox"
          aria-label={label}
          onKeyDown={handleListKeyDown}
          className={cn(MENU_CLASS, menuClassName)}
        >
          {items.map((item, index) => (
            <Link
              key={item.href}
              ref={(node) => {
                itemRefs.current[index] = node
              }}
              href={item.href}
              role="option"
              aria-selected={item.isActive}
              tabIndex={index === activeIndex ? 0 : -1}
              onNavigate={(event) => {
                // 수정 키/새 탭/다운로드 클릭에는 onNavigate 가 불리지 않으므로, 여기
                // 도달했다는 건 같은 탭 이동이 확정됐다는 뜻이다. 기본 내비게이션을 막고
                // 트랜지션으로 감싼 router.push 로 대신해 트리거에 대기 상태를 반영한다.
                event.preventDefault()
                selectItem(item.href)
              }}
              className={cn(ITEM_CLASS, item.isActive ? 'text-ink font-medium' : 'text-ink-muted')}
            >
              <CheckIcon className={cn('h-4 w-4 shrink-0', item.isActive ? '' : 'opacity-0')} />
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
