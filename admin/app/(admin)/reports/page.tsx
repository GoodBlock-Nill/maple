import { CellLink } from '@/components/community/ContentFilters'
import { CommentIcon, DocumentIcon } from '@/components/reports/report-icons'
import { ReportDetailDialog } from '@/components/reports/ReportDetailDialog'
import { ReportTabs } from '@/components/reports/ReportTabs'
import { ReportTypeFilter } from '@/components/reports/ReportTypeFilter'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { FormBanner } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { Table, type Column } from '@/components/ui/Table'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
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
  parseReportTargetType,
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
  const { permissions } = await requirePermission('reports', 'read')
  const canWrite = hasPermission(permissions, 'reports', 'write')
  const searchParams = await props.searchParams
  const requested = firstValue(searchParams.status)
  const status: ReportStatus = REPORT_STATUSES.includes(requested as ReportStatus)
    ? (requested as ReportStatus)
    : 'open'
  const page = parsePage(searchParams.page)
  const type = parseReportTargetType(firstValue(searchParams.type))

  const [counts, list] = await Promise.all([getReportCounts(type), getReports(status, page, type)])

  const columns: readonly Column<ReportItem>[] = [
    {
      key: 'type',
      header: '유형',
      className: 'w-20',
      cell: (row) => {
        /* 게시글 = accent(핑크) · 댓글 = neutral(회색). 종전엔 둘 다 accent 뱃지에
           "게시글"/"댓글" 글자만 달라, 목록을 훑을 때 유형이 구분되지 않는다는
           운영 피드백(2026-09-14)이 있었다 — 톤과 아이콘을 함께 바꿔 눈으로도
           바로 갈린다. */
        const isPost = row.targetType === 'post'
        const Icon = isPost ? DocumentIcon : CommentIcon

        return (
          <span className="flex flex-wrap items-center gap-1">
            <Badge tone={isPost ? 'accent' : 'neutral'} className="gap-1">
              <Icon />
              {REPORT_TARGET_LABEL[row.targetType]}
            </Badge>
            {row.target?.isHidden === true && <Badge tone="warn">숨김</Badge>}
            {row.target?.deletedAt != null && <Badge tone="danger">삭제</Badge>}
          </span>
        )
      },
    },
    {
      key: 'target',
      header: '대상',
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          {/* 제목을 누르면 사용자 사이트의 원문으로 간다(새 탭). 다이얼로그를 열지
              않고도 맥락을 확인할 수 있어야 한다는 운영 피드백(2026-09-14).
              삭제된 대상은 원문이 없으므로 텍스트로 남긴다. */}
          <span className="line-clamp-1" title={row.target?.excerpt}>
            {previewHrefOf(row) === null ? (
              (row.target?.excerpt ?? '(대상을 찾을 수 없음)')
            ) : (
              <CellLink href={previewHrefOf(row) ?? ''} external>
                {row.target?.excerpt}
              </CellLink>
            )}
          </span>
          {/* 댓글만 원 게시글 제목을 한 줄 더 보여준다 — 댓글 발췌만으로는 어느
              글에 달렸는지 알 수 없어 운영자가 매번 원문을 눌러 확인해야 했다. */}
          {row.targetType === 'comment' && (
            <span className="text-muted line-clamp-1 text-[12px]">
              ↳ 게시글: {row.target?.postTitle ?? '(삭제됨)'}
            </span>
          )}
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
          canWrite={canWrite}
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

      <ReportTypeFilter
        active={type}
        buildHref={(next) => buildHref(PATH, searchParams, { type: next ?? null, page: null })}
      />

      {list.hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

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
