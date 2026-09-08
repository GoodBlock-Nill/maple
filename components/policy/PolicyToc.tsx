import Link from 'next/link'

import { cn } from '@/lib/utils/cn'

import type { PolicyTocEntry } from '@/components/policy/policy-prose'

type PolicyTocProps = {
  entries: readonly PolicyTocEntry[]
}

/**
 * 목차. 데스크톱은 항상 펼쳐진 표를 보여주고, 모바일은 `<details>` 로 접어
 * 본문을 먼저 스크롤할 수 있게 한다(요청 사항).
 *
 * 항목은 `{ id, label }` 쌍으로만 받는다. 발행본(DB HTML)은 `<h2>` 에서, 폴백은
 * 구조화된 `PolicySection` 에서 만들어지는데, 목차 자체는 그 차이를 알 필요가 없다.
 */
export function PolicyToc({ entries }: PolicyTocProps) {
  return (
    <>
      <details className="border-line-soft rounded-panel bg-surface group border p-5 lg:hidden">
        <summary className="text-ink -my-2.5 flex min-h-11 cursor-pointer list-none items-center justify-between text-[16px] font-semibold">
          목차
          <span aria-hidden className="text-ink-soft transition-transform group-open:rotate-180">
            ⌄
          </span>
        </summary>
        <TocList entries={entries} className="mt-4" />
      </details>

      <nav
        aria-label="목차"
        className="border-line-soft rounded-panel bg-surface hidden border p-6 lg:block"
      >
        <p className="text-ink text-[16px] font-semibold">목차</p>
        <TocList entries={entries} className="mt-4" />
      </nav>
    </>
  )
}

type TocListProps = {
  entries: readonly PolicyTocEntry[]
  className?: string
}

function TocList({ entries, className }: TocListProps) {
  return (
    <ol className={cn('flex flex-col gap-1 lg:gap-2.5', className)}>
      {entries.map((entry) => (
        <li key={entry.id}>
          <Link
            href={`#${entry.id}`}
            className="text-ink-muted hover:text-ink rounded-pill flex min-h-11 items-center text-[15px] transition-colors lg:min-h-0"
          >
            {entry.label}
          </Link>
        </li>
      ))}
    </ol>
  )
}
