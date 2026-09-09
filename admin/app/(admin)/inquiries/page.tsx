import Link from 'next/link'

import { InquiryFilters } from '@/components/inquiries/InquiryFilters'
import { InquiryStatusBadge } from '@/components/inquiries/InquiryStatusBadge'
import { Card, FormBanner, PageHeader, Pagination, Table, type Column } from '@/components/ui'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import {
  INQUIRY_SORT_KEYS,
  getInquiries,
  getInquiryTabCounts,
  type InquiryListItem,
} from '@/lib/data/inquiries'
import { formatDateTime, formatRelativeDay } from '@/lib/utils/format-date'
import {
  DEFAULT_PAGE_SIZE,
  buildHref,
  parsePage,
  parseSort,
  sortHref,
  totalPages,
} from '@/lib/utils/table-query'
import { maskAccountId, parseInquiryFilters } from '@/lib/validation/inquiries'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '1:1 문의',
}

/* 문의는 사용자가 실시간으로 남기고 운영자가 곧바로 처리한다. 캐시된 목록을
   보여 주면 "방금 온 문의가 없다"는 오해를 부른다. */
export const dynamic = 'force-dynamic'

const LIST_PATH = '/inquiries'

export default async function InquiriesPage(props: PageProps<'/inquiries'>) {
  await requirePermission('inquiries', 'read')
  const params = await props.searchParams
  const filters = parseInquiryFilters(params)
  const sort = parseSort(params.sort, INQUIRY_SORT_KEYS, { key: 'created_at', direction: 'desc' })
  const page = parsePage(params.page)

  const [{ rows, count, hasError }, counts] = await Promise.all([
    getInquiries(filters, { page, sortKey: sort.key, ascending: sort.direction === 'asc' }),
    getInquiryTabCounts(filters),
  ])

  const columns: readonly Column<InquiryListItem>[] = [
    {
      key: 'title',
      header: '제목',
      sortKey: 'title',
      /* 제목이 가장 많이 읽히는 칸이다. 다른 칸이 고정 폭을 가져가면 여기부터
         줄어들어 한 글자만 남는다 — 최소 폭을 명시해 둔다. */
      className: 'min-w-[260px]',
      cell: (row) => (
        <Link
          href={`${LIST_PATH}/${row.id}`}
          className="text-ink hover:text-accent-strong focus-visible:outline-focus line-clamp-1 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {row.title}
        </Link>
      ),
    },
    {
      key: 'author',
      header: '작성자',
      className: 'w-44',
      cell: (row) => (
        <span className="flex flex-col">
          <span className="text-ink">{row.nickname}</span>
          {/* 계정 ID 는 본인 확인용이라 목록에서는 가린다(상세도 마스킹한다). */}
          <span className="text-muted text-[12px]">{maskAccountId(row.accountId)}</span>
        </span>
      ),
    },
    {
      key: 'category',
      header: '카테고리 · 유형',
      className: 'w-32',
      cell: (row) => (
        <span className="text-muted">
          {row.category} · {row.type}
        </span>
      ),
    },
    {
      key: 'status',
      header: '상태',
      sortKey: 'status',
      className: 'w-28',
      cell: (row) => <InquiryStatusBadge status={row.status} cancelledAt={row.cancelledAt} />,
    },
    {
      key: 'replies',
      header: '답변',
      align: 'right',
      className: 'w-16',
      cell: (row) => (
        <span className={row.replyCount === 0 ? 'text-muted' : ''}>{row.replyCount}</span>
      ),
    },
    {
      key: 'createdAt',
      header: '등록일',
      sortKey: 'created_at',
      className: 'w-32',
      cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'updatedAt',
      // 헤더가 좁은 칸에서 두 줄로 접히지 않도록 짧게 쓴다(값은 오늘이면 시:분).
      header: '업데이트',
      sortKey: 'updated_at',
      className: 'w-28',
      cell: (row) => <span className="text-muted">{formatRelativeDay(row.updatedAt)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="1:1 문의"
        description="접수된 문의를 확인하고 답변합니다. 기본 화면은 아직 처리하지 않은 문의입니다."
      />

      <InquiryFilters params={params} filters={filters} counts={counts} />

      {hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

      <Card>
        <Table
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          sort={sort}
          buildSortHref={(key) => sortHref(LIST_PATH, params, sort, key)}
          caption="1:1 문의 목록"
          emptyMessage="조건에 맞는 문의가 없습니다."
        />
        <Pagination
          page={page}
          total={totalPages(count, DEFAULT_PAGE_SIZE)}
          buildHref={(target) => buildHref(LIST_PATH, params, { page: String(target) })}
        />
      </Card>
    </>
  )
}
