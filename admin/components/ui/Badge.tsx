import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

/**
 * `info-blue` · `success-green` · `muted` 는 **사용자 사이트와 같은 것을 보여 주는**
 * 상태 전용이다(문의 상태). 관리자 팔레트(accent 핑크 · success 진초록)를 쓰면 같은
 * 문의가 두 화면에서 다른 색으로 보여, 운영자가 사용자에게 상태를 설명할 수 없다.
 * 관리자 전용 상태(발행 · 노출 · 숨김 …)는 계속 위쪽 팔레트를 쓴다.
 */
export type BadgeTone =
  'neutral' | 'muted' | 'accent' | 'success' | 'success-green' | 'info-blue' | 'warn' | 'danger'

/* 클래스는 리터럴로만 둔다 — Tailwind 는 소스를 정적으로 훑는다. */
const TONE_CLASS: Record<BadgeTone, string> = {
  neutral: 'bg-page text-muted border-line',
  /* 끝난 상태(종료 · 접수 취소). 채우지 않아 neutral 보다 한 단계 물러난다 —
     사용자 사이트의 '종료' 뱃지와 같은 위계다. */
  muted: 'bg-surface text-muted border-line',
  accent: 'bg-accent-soft text-accent-strong border-accent/25',
  success: 'bg-success-soft text-success border-success/25',
  'success-green': 'bg-success-green-soft text-success-green border-success-green/25',
  'info-blue': 'bg-info-blue-soft text-info-blue border-info-blue/25',
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
