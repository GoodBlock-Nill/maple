import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

type EmptyStateProps = {
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({ title, description, action, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-card border-line flex flex-col items-center justify-center gap-2 border border-dashed',
        'bg-sheet/60 px-6 py-10 text-center',
        className,
      )}
    >
      <p className="text-ink text-sm font-bold">{title}</p>
      {description ? <p className="text-ink-muted text-[13px]">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  )
}
