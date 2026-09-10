import Link from 'next/link'

import { CouponPeriod } from '@/components/coupons/CouponPeriod'
import { CouponStatusBadge } from '@/components/coupons/CouponStatusBadge'
import { Card, Pagination, Table, type Column } from '@/components/ui'
import { formatDateTime } from '@/lib/utils/format-date'
import {
  DEFAULT_PAGE_SIZE,
  buildHref,
  sortHref,
  totalPages,
  type QueryParams,
  type SortState,
} from '@/lib/utils/table-query'

import type { CouponListItem } from '@/lib/data/coupons'

const LIST_PATH = '/coupons'

/**
 * 쿠폰 목록 표.
 *
 * 상태를 갖지 않는 서버 컴포넌트라 정렬·페이지는 그대로 링크로 움직인다.
 * 코드 칸이 첫 칸인 이유: 운영자가 이 화면에 오는 대부분의 이유가 "이 코드가 뭐였지"다.
 */
export function CouponTable({
  rows,
  params,
  sort,
  page,
  count,
}: {
  rows: readonly CouponListItem[]
  params: QueryParams
  sort: SortState
  page: number
  count: number
}) {
  const columns: readonly Column<CouponListItem>[] = [
    {
      key: 'code',
      header: '코드',
      sortKey: 'code',
      className: 'w-48',
      cell: (row) => (
        <Link
          href={`${LIST_PATH}/${row.id}`}
          className="text-ink hover:text-accent-strong focus-visible:outline-focus font-mono font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {row.code}
        </Link>
      ),
    },
    {
      key: 'name',
      header: '이름',
      sortKey: 'name',
      className: 'min-w-[200px]',
      cell: (row) => <span className="text-ink line-clamp-1">{row.name}</span>,
    },
    {
      key: 'period',
      header: '기간',
      sortKey: 'ends_at',
      className: 'w-44',
      cell: (row) => <CouponPeriod startsAt={row.startsAt} endsAt={row.endsAt} />,
    },
    {
      key: 'used',
      header: '사용',
      align: 'right',
      className: 'w-28',
      cell: (row) => <UsageCell row={row} />,
    },
    {
      key: 'status',
      header: '상태',
      className: 'w-24',
      cell: (row) => <CouponStatusBadge status={row.status} />,
    },
    {
      key: 'createdAt',
      header: '생성일',
      sortKey: 'created_at',
      className: 'w-32',
      cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
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
        caption="쿠폰 목록"
        emptyMessage="조건에 맞는 쿠폰이 없습니다."
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
 * `사용 n / 한도` 한 칸.
 *
 * 한도가 없는 쿠폰에 `n / -` 를 쓰면 "한도를 못 읽었다"로 읽힌다. '무제한'이라고
 * 적는다. 한도에 닿은 쿠폰은 더 등록되지 않으므로 숫자를 강조해 그 사실을 드러낸다 —
 * 상태 뱃지는 여전히 '활성'이라 여기 말고는 알 길이 없다.
 */
function UsageCell({ row }: { row: CouponListItem }) {
  const isFull = row.maxRedemptions !== null && row.usedCount >= row.maxRedemptions

  return (
    <span className="flex flex-col items-end leading-snug">
      <span className={isFull ? 'text-danger font-semibold' : 'text-ink'}>
        {row.usedCount.toLocaleString('ko-KR')}
        {row.maxRedemptions === null ? '' : ` / ${row.maxRedemptions.toLocaleString('ko-KR')}`}
      </span>
      <span className="text-muted text-[12px]">
        {row.maxRedemptions === null
          ? '무제한'
          : isFull
            ? '한도 도달'
            : `1인 ${row.perUserLimit}회`}
      </span>
    </span>
  )
}
