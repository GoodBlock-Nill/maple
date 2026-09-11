import Link from 'next/link'

import { MemberInquiriesTab } from '@/components/members/MemberInquiriesTab'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { Table, type Column } from '@/components/ui/Table'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format-date'
import {
  contentStatus,
  CONTENT_STATUS_LABEL,
  REPORT_REASON_LABEL,
  REPORT_STATUS_LABEL,
  REPORT_TARGET_LABEL,
} from '@/lib/validation/moderation'

import type { BadgeTone } from '@/components/ui/Badge'
import type { MemberInquirySummary } from '@/lib/data/member-inquiries'
import type { MemberCommentSummary, MemberPostSummary } from '@/lib/data/members'
import type { ReportItem } from '@/lib/data/reports'
import type { ContentStatus } from '@/lib/validation/moderation'

export const ACTIVITY_TABS = [
  'posts',
  'comments',
  'reports-made',
  'reports-received',
  'inquiries',
] as const

export type ActivityTab = (typeof ACTIVITY_TABS)[number]

const TAB_LABEL: Record<ActivityTab, string> = {
  posts: '게시글',
  comments: '댓글',
  'reports-made': '신고함',
  'reports-received': '신고받음',
  inquiries: '1:1 문의',
}

const STATUS_TONE: Record<ContentStatus, BadgeTone> = {
  visible: 'success',
  hidden: 'warn',
  deleted: 'danger',
}

/**
 * 활동 탭.
 *
 * 탭 전환도 URL(`?tab=`)로 한다. 상세 화면에서 조치를 취한 뒤 돌아왔을 때 보고 있던
 * 탭이 유지돼야 하고, "이 회원의 신고받은 목록"을 그대로 링크로 넘길 수 있어야 한다.
 */
export function MemberActivityPanel({
  active,
  counts,
  buildHref,
  posts,
  comments,
  reports,
  inquiries,
  inquiriesHasError,
  canReadInquiries,
  inquiriesMoreHref,
}: {
  active: ActivityTab
  counts: Record<ActivityTab, number>
  buildHref: (tab: ActivityTab) => string
  posts: readonly MemberPostSummary[]
  comments: readonly MemberCommentSummary[]
  reports: readonly ReportItem[]
  inquiries: readonly MemberInquirySummary[]
  /** 문의 목록 조회가 깨졌는지. */
  inquiriesHasError: boolean
  /** `inquiries:read` 없는 운영자에게는 행을 보여 주지 않는다(members:read 만으로는 부족). */
  canReadInquiries: boolean
  /** 표시한 건수보다 실제 건수가 많을 때만 온다 — `/inquiries?user=<id>`. */
  inquiriesMoreHref: string | null
}) {
  return (
    <Card>
      <nav aria-label="활동" className="border-line flex items-end gap-1 border-b px-2">
        {ACTIVITY_TABS.map((tab) => (
          <Link
            key={tab}
            href={buildHref(tab)}
            aria-current={tab === active ? 'page' : undefined}
            className={cn(
              'focus-visible:outline-focus -mb-px border-b-2 px-3 py-2.5 text-[13px] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
              tab === active
                ? 'border-accent text-accent-strong'
                : 'text-muted hover:text-ink border-transparent',
            )}
          >
            {TAB_LABEL[tab]} {counts[tab].toLocaleString('ko-KR')}
          </Link>
        ))}
      </nav>

      {active === 'posts' && (
        <Table
          columns={POST_COLUMNS}
          rows={posts}
          getRowKey={(row) => row.id}
          caption="회원이 쓴 게시글"
          emptyMessage="작성한 게시글이 없습니다."
        />
      )}

      {active === 'comments' && (
        <Table
          columns={COMMENT_COLUMNS}
          rows={comments}
          getRowKey={(row) => row.id}
          caption="회원이 쓴 댓글"
          emptyMessage="작성한 댓글이 없습니다."
        />
      )}

      {(active === 'reports-made' || active === 'reports-received') && (
        <Table
          columns={REPORT_LIST_COLUMNS}
          rows={reports}
          getRowKey={(row) => row.id}
          caption="신고 목록"
          emptyMessage={
            active === 'reports-made' ? '접수한 신고가 없습니다.' : '받은 신고가 없습니다.'
          }
        />
      )}

      {active === 'inquiries' && (
        <MemberInquiriesTab
          canRead={canReadInquiries}
          rows={inquiries}
          hasError={inquiriesHasError}
          moreHref={inquiriesMoreHref}
        />
      )}
    </Card>
  )
}

function StatusBadge({ row }: { row: { isHidden: boolean; deletedAt: string | null } }) {
  const status = contentStatus(row)

  return <Badge tone={STATUS_TONE[status]}>{CONTENT_STATUS_LABEL[status]}</Badge>
}

const POST_COLUMNS: readonly Column<MemberPostSummary>[] = [
  {
    key: 'title',
    header: '제목',
    cell: (row) => <span className="line-clamp-1">{row.title}</span>,
  },
  { key: 'category', header: '카테고리', className: 'w-24', cell: (row) => row.categoryKey },
  { key: 'status', header: '상태', className: 'w-20', cell: (row) => <StatusBadge row={row} /> },
  {
    key: 'created_at',
    header: '작성일',
    className: 'w-36',
    cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
  },
]

const COMMENT_COLUMNS: readonly Column<MemberCommentSummary>[] = [
  {
    key: 'content',
    header: '내용',
    cell: (row) => <span className="line-clamp-2">{row.content}</span>,
  },
  { key: 'status', header: '상태', className: 'w-20', cell: (row) => <StatusBadge row={row} /> },
  {
    key: 'created_at',
    header: '작성일',
    className: 'w-36',
    cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
  },
]

const REPORT_LIST_COLUMNS: readonly Column<ReportItem>[] = [
  {
    key: 'target',
    header: '대상',
    cell: (row) => (
      <span className="flex items-center gap-1.5">
        <Badge tone="accent">{REPORT_TARGET_LABEL[row.targetType]}</Badge>
        <span className="line-clamp-1">{row.target?.excerpt ?? '(대상 없음)'}</span>
      </span>
    ),
  },
  {
    key: 'reason',
    header: '사유',
    className: 'w-28',
    cell: (row) => REPORT_REASON_LABEL[row.reason],
  },
  { key: 'reporter', header: '신고자', className: 'w-24', cell: (row) => row.reporterNickname },
  {
    key: 'status',
    header: '상태',
    className: 'w-24',
    cell: (row) => (
      <Badge tone={row.status === 'open' ? 'warn' : 'neutral'}>
        {REPORT_STATUS_LABEL[row.status]}
      </Badge>
    ),
  },
  {
    key: 'created_at',
    header: '신고일',
    className: 'w-36',
    cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
  },
]
