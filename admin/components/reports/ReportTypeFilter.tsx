import Link from 'next/link'

import { cn } from '@/lib/utils/cn'
import { REPORT_TARGET_LABEL } from '@/lib/validation/moderation'

import type { ReportTargetType } from '@/lib/data/reports'

const TYPE_OPTIONS: readonly { value: ReportTargetType | undefined; label: string }[] = [
  { value: undefined, label: '전체' },
  { value: 'post', label: REPORT_TARGET_LABEL.post },
  { value: 'comment', label: REPORT_TARGET_LABEL.comment },
]

/**
 * 대상 유형 필터(전체 · 게시글 · 댓글).
 *
 * 상태 탭(`ReportTabs`)과 축이 다르다 — 상태는 처리 진행도, 유형은 대상 종류라
 * 동시에 켜져 있어야 한다. 그래서 같은 탭 줄에 묶지 않고 칩으로 따로 두되,
 * `buildHref` 가 현재 쿼리(상태 · 페이지 등)를 그대로 물려받아 두 필터가
 * 서로를 지우지 않는다(`InquiryFilters` 의 상태 탭과 같은 칩 스타일).
 */
export function ReportTypeFilter({
  active,
  buildHref,
}: {
  active: ReportTargetType | undefined
  buildHref: (type: ReportTargetType | undefined) => string
}) {
  return (
    <nav aria-label="신고 대상 유형" className="mb-4 flex flex-wrap gap-1.5">
      {TYPE_OPTIONS.map((option) => {
        const isActive = option.value === active

        return (
          <Link
            key={option.label}
            href={buildHref(option.value)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-pill focus-visible:outline-focus border px-3 py-1.5 text-[13px] font-semibold',
              'focus-visible:outline-2 focus-visible:outline-offset-2',
              isActive
                ? 'border-accent bg-accent text-white'
                : 'border-line bg-surface text-muted hover:text-ink hover:bg-page',
            )}
          >
            {option.label}
          </Link>
        )
      })}
    </nav>
  )
}
