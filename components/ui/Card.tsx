import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

type CardProps = {
  className?: string
  children: ReactNode
}

export function Card({ className, children }: CardProps) {
  return (
    <div
      className={cn(
        'rounded-panel border-line bg-surface shadow-card flex flex-col overflow-hidden border',
        className,
      )}
    >
      {children}
    </div>
  )
}

type CardHeaderProps = {
  title: ReactNode
  /** 우측 액션 슬롯 — "더보기" 링크 등. */
  action?: ReactNode
  className?: string
}

export function CardHeader({ title, action, className }: CardHeaderProps) {
  return (
    <div
      className={cn(
        'border-line/80 flex items-center justify-between gap-3 border-b px-5 py-4 sm:px-6',
        className,
      )}
    >
      <h2 className="text-ink text-lg font-semibold tracking-tight sm:text-xl">{title}</h2>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

type CardBodyProps = {
  className?: string
  children: ReactNode
}

export function CardBody({ className, children }: CardBodyProps) {
  return <div className={cn('flex flex-1 flex-col px-5 py-5 sm:px-6', className)}>{children}</div>
}
