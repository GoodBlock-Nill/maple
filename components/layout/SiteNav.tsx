'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { isNavItemHidden, matchesPath } from '@/components/layout/navigation'
import { NAV_ITEMS } from '@/lib/constants/site'
import { cn } from '@/lib/utils/cn'

type SiteNavProps = {
  id?: string
  className?: string
}

export function SiteNav({ id, className }: SiteNavProps) {
  const pathname = usePathname()

  return (
    <nav id={id} aria-label="주 메뉴" className={className}>
      <ul className="flex items-center gap-[50px]">
        {NAV_ITEMS.filter((item) => !isNavItemHidden(item.href)).map((item) => {
          const isActive = matchesPath(item.href, pathname)

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  /* 시안 헤더 GNB 만 Inter Semibold 16 이다(본문 Switzer 와 다르다). */
                  'font-ui inline-flex items-center text-[16px] font-semibold',
                  'tracking-[-0.2px] whitespace-nowrap transition-[color,opacity]',
                  /* 활성: 텍스트 #e8308a + 텍스트 상자 바로 아래 2px 밑줄(시안 §1 실측,
                     border-bottom 방식 — 기존 after 검은 밑줄을 대체한다).
                     비활성: 기존 #2a2a2a(text-ink) + 호버 시 옅어짐 유지. */
                  isActive
                    ? 'border-b-2 border-[#e8308a] pb-1 text-[#e8308a]'
                    : 'text-ink border-b-2 border-transparent pb-1 hover:opacity-65',
                )}
              >
                {item.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
