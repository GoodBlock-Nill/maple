import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

export type BadgeTone = 'neutral' | 'accent' | 'success' | 'warn' | 'danger'

/* 클래스는 리터럴로만 둔다 — Tailwind 는 소스를 정적으로 훑는다. */
const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-page text-muted border-line',
  accent: 'bg-accent-soft text-accent-strong border-accent/25',
  success: 'bg-success-soft text-success border-success/25',
  warn: 'bg-warn-soft text-warn border-warn/25',
  danger: 'bg-danger-soft text-danger border-danger/25',
}

export function Badge({
  tone = 'neutral',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'rounded-pill inline-flex items-center border px-2 py-0.5 text-[12px] font-semibold whitespace-nowrap',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
