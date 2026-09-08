import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

type ListSheetProps = {
  className?: string
  children: ReactNode
}

/** 목록 카드를 담는 회색 트레이. bg #ededed · radius 20 · padding 16 (시안 실측). */
export function ListSheet({ className, children }: ListSheetProps) {
  return <div className={cn('bg-tray rounded-panel shadow-tray p-4', className)}>{children}</div>
}
