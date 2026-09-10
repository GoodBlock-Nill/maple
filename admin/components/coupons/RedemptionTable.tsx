import Link from 'next/link'

import { RedemptionStatusBadge } from '@/components/coupons/RedemptionStatusBadge'
import { RedemptionStatusButton } from '@/components/coupons/RedemptionStatusButton'
import { Pagination, Table, type Column } from '@/components/ui'
import { formatDateTime } from '@/lib/utils/format-date'
import { DEFAULT_PAGE_SIZE, buildHref, totalPages, type QueryParams } from '@/lib/utils/table-query'

import type { RedemptionListItem } from '@/lib/data/coupons'

/**
 * 쿠폰 등록 내역 표.
 *
 * 정렬 링크를 두지 않는다 — 이 표는 언제나 **접수 역순**이다. 게임팀에 넘기는 단위가
 * "언제 들어온 것까지 처리했는가"라, 정렬을 바꿀 수 있게 하면 복사 버튼이 무엇을
 * 담았는지 설명하기 어려워진다.
 *
 * 닉네임은 등록 시점 스냅샷이다(`nickname_snapshot`). 회원이 탈퇴·파기돼도 이 값은
 * 남고, `userId` 가 살아 있을 때만 회원 상세로 이어 준다.
 */
export function RedemptionTable({
  rows,
  couponId,
  params,
  page,
  count,
  canWrite,
}: {
  rows: readonly RedemptionListItem[]
  couponId: string
  params: QueryParams
  page: number
  count: number
  canWrite: boolean
}) {
  const columns: readonly Column<RedemptionListItem>[] = [
    {
      key: 'member',
      header: '닉네임',
      className: 'w-40',
      cell: (row) =>
        row.userId === null ? (
          <span className="text-ink">{row.nickname}</span>
        ) : (
          <Link
            href={`/members/${row.userId}`}
            className="text-ink hover:text-accent-strong focus-visible:outline-focus font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {row.nickname}
          </Link>
        ),
    },
    {
      key: 'mswUid',
      header: 'MSW UID',
      className: 'w-44',
      cell: (row) => <span className="text-ink font-mono text-[12px]">{row.mswUid}</span>,
    },
    {
      key: 'mswProfileCode',
      header: '프로필 코드',
      className: 'w-28',
      cell: (row) => <span className="text-muted font-mono text-[12px]">{row.mswProfileCode}</span>,
    },
    {
      key: 'createdAt',
      header: '등록일',
      className: 'w-32',
      cell: (row) => <span className="text-muted">{formatDateTime(row.createdAt)}</span>,
    },
    {
      key: 'status',
      header: '상태',
      className: 'w-24',
      cell: (row) => <RedemptionStatusBadge status={row.status} />,
    },
    {
      key: 'processed',
      header: '처리자 · 처리일',
      className: 'w-36',
      cell: (row) =>
        row.processedAt === null ? (
          <span className="text-muted">-</span>
        ) : (
          <span className="text-muted flex flex-col leading-snug">
            <span className="text-ink">{row.processorNickname ?? '(삭제된 계정)'}</span>
            <span className="text-[12px]">{formatDateTime(row.processedAt)}</span>
          </span>
        ),
    },
    {
      key: 'note',
      header: '메모',
      className: 'min-w-[160px]',
      cell: (row) => (
        <span className="text-muted line-clamp-2 text-[12px]">{row.adminNote ?? '-'}</span>
      ),
    },
    {
      key: 'actions',
      header: '처리',
      align: 'right',
      className: 'w-40',
      cell: (row) =>
        !canWrite || row.status !== 'pending' ? null : (
          <span className="flex justify-end gap-1.5">
            <RedemptionStatusButton
              redemptionId={row.id}
              nickname={row.nickname}
              status="delivered"
            />
            <RedemptionStatusButton
              redemptionId={row.id}
              nickname={row.nickname}
              status="rejected"
            />
          </span>
        ),
    },
  ]

  return (
    <>
      <Table
        columns={columns}
        rows={rows}
        getRowKey={(row) => row.id}
        caption="쿠폰 등록 내역"
        emptyMessage="조건에 맞는 등록 내역이 없습니다."
      />
      <Pagination
        page={page}
        total={totalPages(count, DEFAULT_PAGE_SIZE)}
        buildHref={(target) => buildHref(`/coupons/${couponId}`, params, { page: String(target) })}
      />
    </>
  )
}
