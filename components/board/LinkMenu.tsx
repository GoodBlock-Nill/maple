'use client'

import Link from 'next/link'
import { useEffect, useId, useRef, useState } from 'react'

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

/**
 * URL 링크로 이동하는 드롭다운.
 * 목록 필터는 전부 searchParams 로 표현하므로 메뉴 항목은 전부 `<Link>` 다.
 * 바깥 클릭·ESC 로 닫히며, 트리거로 포커스를 되돌린다.
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
  const menuId = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

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

  return (
    <div ref={rootRef} className={cn('relative', className)}>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((previous) => !previous)}
        className={triggerClassName}
      >
        {trigger}
      </button>

      {isOpen ? (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className={cn(
            'shadow-menu absolute top-[calc(100%+8px)] right-0 z-30 min-w-[140px]',
            'flex flex-col gap-0.5 rounded-[10px] bg-white p-2',
            menuClassName,
          )}
        >
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              role="menuitem"
              onClick={() => setIsOpen(false)}
              className={cn(
                'text-ink rounded-lg px-3 py-2 text-[17px] whitespace-nowrap transition-colors',
                item.isActive ? 'bg-[#dbdbdb]' : 'hover:bg-[#f0f0f0]',
              )}
            >
              {item.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  )
}
