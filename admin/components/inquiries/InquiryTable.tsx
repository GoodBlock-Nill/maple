import Link from 'next/link'

import { InquiryStatusBadge } from '@/components/inquiries/InquiryStatusBadge'
import { Badge, Card, Pagination, Table, type Column } from '@/components/ui'
import { formatDateTime, formatRelativeDay } from '@/lib/utils/format-date'
import {
  DEFAULT_PAGE_SIZE,
  buildHref,
  sortHref,
  totalPages,
  type QueryParams,
  type SortState,
} from '@/lib/utils/table-query'
import {
  INQUIRY_SOURCE_LABELS,
  inquiryCategoryLabel,
  inquiryTypeLabel,
  maskAccountId,
} from '@/lib/validation/inquiries'

import type { InquiryListItem } from '@/lib/data/inquiries'

const LIST_PATH = '/inquiries'

/**
 * 문의 목록 표.
 *
 * 페이지에서 떼어 낸 것은 출처 칸이 붙으면서 컬럼 정의만으로 화면 파일이 200줄을
 * 넘기 때문이다. 상태를 갖지 않는 서버 컴포넌트라 정렬·페이지는 그대로 링크로 움직인다.
 */
export function InquiryTable({
  rows,
  params,
  sort,
  page,
  count,
}: {
  rows: readonly InquiryListItem[]
  params: QueryParams
  sort: SortState
  page: number
  count: number
}) {
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
      key: 'source',
      header: '출처',
      className: 'w-20',
      cell: (row) => (
        <Badge tone={row.source === 'email' ? 'accent' : 'neutral'}>
          {INQUIRY_SOURCE_LABELS[row.source]}
        </Badge>
      ),
    },
    {
      key: 'author',
      // 이메일 문의에는 회원이 없다. '작성자'라고 쓰면 발신자를 회원으로 오해한다.
      header: '계정',
      className: 'w-44',
      cell: (row) => <AccountCell row={row} />,
    },
    {
      key: 'category',
      header: '카테고리 · 유형',
      className: 'w-32',
      cell: (row) => (
        <span className="text-muted">
          {inquiryCategoryLabel(row.category)} · {inquiryTypeLabel(row.type)}
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
    <Card>
      <Table
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        sort={sort}
        buildSortHref={(key) => sortHref(LIST_PATH, params, sort, key)}
        caption="문의 목록"
        emptyMessage="조건에 맞는 문의가 없습니다."
      />
      <Pagination
        page={page}
        total={totalPages(count, DEFAULT_PAGE_SIZE)}
        buildHref={(target) => buildHref(LIST_PATH, params, { page: String(target) })}
      />
    </Card>
  )
}

/**
 * 웹 문의는 닉네임 + 마스킹한 계정 ID, 이메일 문의는 발신자 주소를 보여 준다.
 *
 * 인증(SPF·DKIM·DMARC)이 하나라도 실패한 메일은 여기에서 표시한다 — 답신을 쓰기
 * 전에 사칭 가능성을 알아야 한다(EMAIL-INQUIRY-PLAN §8).
 */
function AccountCell({ row }: { row: InquiryListItem }) {
  if (row.source === 'email') {
    return (
      <span className="flex flex-col gap-1">
        <span className="text-ink font-mono text-[12px] break-all">{row.emailFrom ?? '-'}</span>
        {row.emailAuthFailed && <Badge tone="warn">인증 실패</Badge>}
      </span>
    )
  }

  return (
    <span className="flex flex-col">
      <span className="text-ink">{row.nickname}</span>
      {/* 계정 ID 는 본인 확인용이라 목록에서는 가린다(상세도 마스킹한다). */}
      <span className="text-muted text-[12px]">{maskAccountId(row.accountId)}</span>
    </span>
  )
}
