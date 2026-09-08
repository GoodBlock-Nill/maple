import { BADGE_CLASS } from '@/lib/constants/categories'
import { cn } from '@/lib/utils/cn'

import type { BadgeColor } from '@/lib/constants/categories'
import type { ReactNode } from 'react'

export type BadgeSize = 'sm' | 'md'

/** sm: 카드 라벨(12px bold) · md: 게시판 말머리(17px medium, 시안 실측). */
const SIZE_CLASS: Record<BadgeSize, string> = {
  sm: 'min-w-14 px-2.5 py-1 text-[12px] leading-none font-bold tracking-tight',
  md: 'px-2.5 py-[5px] text-ui leading-none font-medium',
}

type BadgeProps = {
  color?: BadgeColor
  size?: BadgeSize
  className?: string
  children: ReactNode
}

export function Badge({ color = 'gray', size = 'sm', className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        'rounded-pill inline-flex items-center justify-center whitespace-nowrap',
        SIZE_CLASS[size],
        BADGE_CLASS[color],
        className,
      )}
    >
      {children}
    </span>
  )
}
