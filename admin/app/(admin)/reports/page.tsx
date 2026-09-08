import { ReportDetailDialog } from '@/components/reports/ReportDetailDialog'
import { ReportTabs } from '@/components/reports/ReportTabs'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Table, type Column } from '@/components/ui/Table'
import { getReportCounts, getReports, type ReportItem } from '@/lib/data/reports'
import { clientSiteUrl } from '@/lib/supabase/env'
import { formatDateTime } from '@/lib/utils/format-date'
import {
  buildHref,
  DEFAULT_PAGE_SIZE,
  firstValue,
  parsePage,
  totalPages,
} from '@/lib/utils/table-query'
import {
  REPORT_REASON_LABEL,
  REPORT_STATUSES,
  REPORT_TARGET_LABEL,
} from '@/lib/validation/moderation'

import type { ReportStatus } from '@/lib/validation/moderation'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '신고',
}

export const dynamic = 'force-dynamic'

const PATH = '/reports'

/** 대상의 원문 주소. 게시글은 자기 주소, 댓글은 달린 게시글로 보낸다. */
function previewHrefOf(report: ReportItem): string | null {
  const postId = report.target?.postId

  if (postId === undefined || postId === null || report.target?.deletedAt !== null) {
    return null
  }

  return `${clientSiteUrl()}/community/${postId}`
}

export default async function ReportsPage(props: PageProps<'/reports'>) {
  const searchParams = await props.searchParams
  const requested = firstValue(searchParams.status)
  const status: ReportStatus = REPORT_STATUSES.includes(requested as ReportStatus)
    ? (requested as ReportStatus)
    : 'open'
  const page = parsePage(searchParams.page)

  const [counts, list] = await Promise.all([getReportCounts(), getReports(status, page)])

  const columns: readonly Column<ReportItem>[] = [
    {
      key: 'target',
      header: '대상',
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <Badge tone="accent">{REPORT_TARGET_LABEL[row.targetType]}</Badge>
            {row.target?.isHidden === true && <Badge tone="warn">숨김</Badge>}
            {row.target?.deletedAt != null && <Badge tone="danger">삭제</Badge>}
          </span>
          <span className="line-clamp-1" title={row.target?.excerpt}>
            {row.target?.excerpt ?? '(대상을 찾을 수 없음)'}
          </span>
        </span>
      ),
    },
    {
      key: 'reason',
      header: '사유',
      className: 'w-28',
      cell: (row) => <Badge tone="warn">{REPORT_REASON_LABEL[row.reason]}</Badge>,
    },
    {
      key: 'detail',
      header: '상세',
      className: 'w-56',
      cell: (row) => (
        <span className="text-muted line-clamp-2" title={row.detail ?? undefined}>
          {row.detail ?? '-'}
        </span>
      ),
    },
    {
      key: 'reporter',
      header: '신고자',
      className: 'w-28',
      cell: (row) => row.reporterNickname,
    },
    {
      key: 'created_at',
      header: '신고일',
      className: 'w-36',
      cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'count',
      header: '누적',
      align: 'right',
      className: 'w-16',
      cell: (row) => (
        <span className={row.history.length > 1 ? 'text-danger font-bold' : undefined}>
          {row.history.length}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-24',
      cell: (row) => (
        <ReportDetailDialog
          report={row}
          previewHref={previewHrefOf(row)}
          authorHref={
            row.target?.authorId == null || row.target.authorId === ''
              ? null
              : `/members/${row.target.authorId}`
          }
        />
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="신고"
        description="접수된 신고를 검토하고 숨김·삭제·정지로 연계합니다. 처리 메모는 감사 로그에 남습니다."
      />

      <ReportTabs
        active={status}
        counts={counts}
        buildHref={(next) => buildHref(PATH, searchParams, { status: next, page: null })}
      />

      <Card>
        <Table
          columns={columns}
          rows={list.rows}
          getRowKey={(row) => row.id}
          caption="신고 목록"
          emptyMessage="이 상태의 신고가 없습니다."
        />
        <Pagination
          page={list.page}
          total={totalPages(list.count, DEFAULT_PAGE_SIZE)}
          buildHref={(next) => buildHref(PATH, searchParams, { page: String(next) })}
        />
      </Card>
    </>
  )
}
