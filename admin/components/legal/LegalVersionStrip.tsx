import Link from 'next/link'

import { LEGAL_STATUS_TONE } from '@/lib/constants/legal'
import { cn } from '@/lib/utils/cn'

import type { LegalStripChip } from '@/lib/validation/legal-state'

/**
 * 버전 칩 줄 — 시행 중 · 예약 · 초안.
 *
 * 이력 탭을 열지 않아도 "지금 무엇이 걸려 있는지" 보이고, 그 자리에서 해당
 * 개정본을 열 수 있어야 한다. 칩은 전부 `?version=` 링크다.
 */

/* 색 조합은 뱃지(`LEGAL_STATUS_TONE`)와 같은 값을 쓴다 — 같은 상태가 칩과 뱃지에서
   다른 색이면 운영자가 둘을 다른 것으로 읽는다. Tailwind 가 소스를 정적으로 훑으므로
   클래스는 리터럴로만 둔다. */
const TONE_CLASS: Record<'neutral' | 'warn' | 'success', string> = {
  neutral: 'bg-page text-muted border-line hover:bg-surface',
  warn: 'bg-warn-soft text-warn border-warn/25 hover:border-warn/50',
  success: 'bg-success-soft text-success border-success/25 hover:border-success/50',
}

export function LegalVersionStrip({
  chips,
  selectedId,
  buildHref,
}: {
  chips: readonly LegalStripChip[]
  /** 지금 열려 있는 개정본 id. 그 칩만 테두리를 진하게 둔다. */
  selectedId: string
  buildHref: (versionId: string) => string
}) {
  if (chips.length === 0) {
    return null
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2" data-testid="legal-version-strip">
      {chips.map((chip) => (
        <Link
          key={chip.key}
          href={buildHref(chip.versionId)}
          aria-current={chip.versionId === selectedId ? 'true' : undefined}
          className={cn(
            'rounded-pill focus-visible:outline-focus inline-flex items-center border px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2',
            TONE_CLASS[LEGAL_STATUS_TONE[chip.status]],
            chip.versionId === selectedId ? 'ring-accent/40 ring-2' : null,
          )}
        >
          {chip.label}
        </Link>
      ))}
    </div>
  )
}
