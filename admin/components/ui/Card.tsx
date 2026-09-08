import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

/** 관리자 화면의 기본 표면. 목록·폼·통계가 모두 이 위에 올라간다. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <section
      className={cn('border-line bg-surface rounded-card shadow-card border', className)}
    >
      {children}
    </section>
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <header
      className={cn(
        'border-line flex items-start justify-between gap-4 border-b px-5 py-4',
        className,
      )}
    >
      <div className="flex flex-col gap-0.5">
        <h2 className="text-ink text-[15px] font-bold">{title}</h2>
        {description !== undefined && <p className="text-muted text-[13px]">{description}</p>}
      </div>
      {action}
    </header>
  )
}

export function CardBody({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('px-5 py-4', className)}>{children}</div>
}
