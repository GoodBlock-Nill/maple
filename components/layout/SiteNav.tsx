'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import { matchesPath } from '@/components/layout/navigation'
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
        {NAV_ITEMS.map((item) => {
          const isActive = matchesPath(item.href, pathname)

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  /* 시안 헤더 GNB 만 Inter Semibold 16 이다(본문 Switzer 와 다르다). */
                  'font-ui rounded-pill relative inline-flex items-center text-[16px] font-semibold',
                  'text-ink tracking-[-0.2px] whitespace-nowrap transition-opacity',
                  'after:rounded-pill after:absolute after:inset-x-0 after:-bottom-1.5 after:h-0.5',
                  'after:bg-ink after:transition-transform after:duration-200',
                  isActive ? 'after:scale-x-100' : 'after:scale-x-0 hover:opacity-65',
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
