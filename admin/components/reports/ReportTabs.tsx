import Link from 'next/link'

import { cn } from '@/lib/utils/cn'
import { REPORT_STATUS_LABEL, REPORT_STATUSES } from '@/lib/validation/moderation'

import type { ReportCounts } from '@/lib/data/reports'
import type { ReportStatus } from '@/lib/validation/moderation'

/**
 * 신고 큐 탭.
 *
 * 상태를 갖지 않는 링크다. 탭 전환이 곧 URL 이므로 뒤로가기·새로고침·공유가
 * 같은 화면을 낸다. 건수를 라벨 옆에 붙여 "미처리가 남았는지"를 탭을 열지 않고 안다.
 */
export function ReportTabs({
  active,
  counts,
  buildHref,
}: {
  active: ReportStatus
  counts: ReportCounts
  buildHref: (status: ReportStatus) => string
}) {
  return (
    <nav aria-label="신고 상태" className="border-line mb-4 flex items-end gap-1 border-b">
      {REPORT_STATUSES.map((status) => {
        const isActive = status === active

        return (
          <Link
            key={status}
            href={buildHref(status)}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'focus-visible:outline-focus -mb-px flex items-center gap-1.5 border-b-2 px-4 py-2.5 text-[14px] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
              isActive
                ? 'border-accent text-accent-strong'
                : 'hover:text-ink border-transparent text-muted',
            )}
          >
            {REPORT_STATUS_LABEL[status]}
            <span
              className={cn(
                'rounded-pill px-1.5 py-0.5 text-[12px]',
                isActive ? 'bg-accent-soft text-accent-strong' : 'bg-page text-muted',
              )}
            >
              {counts[status].toLocaleString('ko-KR')}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
