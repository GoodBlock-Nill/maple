import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

export type StatTone = 'default' | 'accent' | 'warn' | 'danger'

const VALUE_TONE_CLASS: Record<StatTone, string> = {
  default: 'text-ink',
  accent: 'text-accent-strong',
  warn: 'text-warn',
  danger: 'text-danger',
}

/**
 * 대시보드 지표 카드.
 *
 * 값은 `Intl.NumberFormat` 대신 `toLocaleString('ko-KR')` 를 서버에서 한 번만
 * 계산해 문자열로 넘긴다 — 클라이언트 로캘에 따라 서식이 갈리면 하이드레이션이 깨진다.
 */
export function StatCard({
  label,
  value,
  hint,
  tone = 'default',
  testId,
}: {
  label: string
  value: string
  hint?: ReactNode
  tone?: StatTone
  testId?: string
}) {
  return (
    <div
      data-testid={testId}
      className="border-line bg-surface rounded-card shadow-card flex flex-col gap-1 border px-4 py-3.5"
    >
      <span className="text-muted text-[12px] font-semibold">{label}</span>
      <strong className={cn('text-[26px] leading-none font-bold', VALUE_TONE_CLASS[tone])}>
        {value}
      </strong>
      {hint !== undefined && <span className="text-muted text-[12px]">{hint}</span>}
    </div>
  )
}
