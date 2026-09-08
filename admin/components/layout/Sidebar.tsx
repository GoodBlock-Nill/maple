'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { NavIconGlyph } from '@/components/layout/nav-icons'
import { isNavItemActive, isPathActive, NAV_ITEMS } from '@/lib/nav'
import { cn } from '@/lib/utils/cn'

/**
 * 좌측 내비게이션 — 260px 고정, 사이드바 색(#1f2430).
 *
 * 1024px 미만에서는 화면 밖으로 밀어 두고 상단 바의 버튼으로 연다(드로어).
 * `hidden` 이 아니라 `-translate-x-full` 로 숨기는 이유: 트랜지션이 가능하고,
 * 열려 있는 동안 포커스 순서가 자연스럽게 유지된다.
 */
export function Sidebar({ isOpen, onNavigate }: { isOpen: boolean; onNavigate: () => void }) {
  const pathname = usePathname()

  return (
    <nav
      aria-label="관리 메뉴"
      className={cn(
        'bg-sidebar fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col transition-transform duration-200 lg:translate-x-0',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}
    >
      <Link
        href="/"
        onClick={onNavigate}
        className="focus-visible:outline-focus flex h-16 shrink-0 items-center px-6 focus-visible:outline-2 focus-visible:-outline-offset-2"
      >
        <span className="font-maple text-[18px] font-bold text-white">
          글자월드 <span className="text-accent">ADMIN</span>
        </span>
      </Link>

      <ul className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-3 pb-6">
        {NAV_ITEMS.map((item) => {
          const isActive = isNavItemActive(item, pathname)

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'relative flex items-center gap-2.5 rounded-panel px-3 py-2.5 text-[14px] font-semibold transition-colors',
                  'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white',
                  isActive
                    ? 'bg-sidebar-hover text-white'
                    : 'text-white/60 hover:bg-sidebar-hover hover:text-white',
                )}
              >
                {/* 활성 표시는 색만으로 두지 않는다 — 왼쪽 액센트 바가 색각 이상에서도 읽힌다. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-sm',
                    isActive ? 'bg-accent' : 'bg-transparent',
                  )}
                />
                <NavIconGlyph name={item.icon} />
                {item.label}
              </Link>

              {isActive && item.children !== undefined && (
                <ul className="mt-0.5 mb-1 flex flex-col gap-0.5 pl-[42px]">
                  {item.children.map((child) => {
                    const isChildActive = isPathActive(child.href, pathname)

                    return (
                      <li key={child.href}>
                        <Link
                          href={child.href}
                          onClick={onNavigate}
                          aria-current={isChildActive ? 'page' : undefined}
                          className={cn(
                            'rounded-panel block px-3 py-1.5 text-[13px] transition-colors',
                            'focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white',
                            isChildActive
                              ? 'text-accent font-semibold'
                              : 'text-white/50 hover:text-white',
                          )}
                        >
                          {child.label}
                        </Link>
                      </li>
                    )
                  })}
                </ul>
              )}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
