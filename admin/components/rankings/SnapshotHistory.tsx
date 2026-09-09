import Link from 'next/link'

import { RollbackSnapshotButton } from '@/components/rankings/RollbackSnapshotButton'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { Table, type Column } from '@/components/ui/Table'
import { formatDateTime } from '@/lib/utils/format-date'
import { SNAPSHOT_RETENTION } from '@/lib/validation/rankings'

import type { SnapshotSummary } from '@/lib/data/rankings'
import type { RankType } from '@/lib/validation/rankings'

/**
 * 스냅샷 이력.
 *
 * 랭킹은 스냅샷 단위로 적재되고 사용자 사이트는 **가장 최근 것만** 읽는다.
 * 따라서 목록의 첫 줄이 곧 "지금 사이트에 보이는 표"다.
 */
export function SnapshotHistory({
  rankType,
  snapshots,
  currentSnapshot,
  viewing,
}: {
  rankType: RankType
  snapshots: readonly SnapshotSummary[]
  currentSnapshot: string | null
  viewing: string | null
}) {
  const columns: readonly Column<SnapshotSummary>[] = [
    {
      key: 'snapshotAt',
      header: '스냅샷 시각',
      cell: (row) => (
        <span className="flex items-center gap-2">
          <span className="font-semibold">{formatDateTime(row.snapshotAt)}</span>
          {row.snapshotAt === currentSnapshot && <Badge tone="success">현재</Badge>}
          {row.snapshotAt === viewing && row.snapshotAt !== currentSnapshot && (
            <Badge tone="accent">보는 중</Badge>
          )}
        </span>
      ),
    },
    {
      key: 'count',
      header: '건수',
      align: 'right',
      className: 'w-24',
      cell: (row) => <span>{row.count}</span>,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      className: 'w-48',
      cell: (row) => (
        <span className="flex items-center justify-end gap-1.5">
          <Link
            href={`/rankings?type=${rankType}&snapshot=${encodeURIComponent(row.snapshotAt)}`}
            className="text-accent-strong focus-visible:outline-focus rounded-sm px-2 text-[13px] font-semibold hover:underline focus-visible:outline-2"
          >
            보기
          </Link>
          {row.snapshotAt !== currentSnapshot && (
            <RollbackSnapshotButton
              rankType={rankType}
              snapshotAt={row.snapshotAt}
              label={formatDateTime(row.snapshotAt)}
              count={row.count}
            />
          )}
        </span>
      ),
    },
  ]

  return (
    <Card>
      <CardHeader
        title={`스냅샷 이력 ${snapshots.length}벌`}
        description={`적재하거나 되돌릴 때마다 새 스냅샷이 쌓이고, 최근 ${SNAPSHOT_RETENTION}벌까지 보관합니다.`}
      />
      <Table
        columns={columns}
        rows={snapshots}
        getRowKey={(row) => row.snapshotAt}
        caption="랭킹 스냅샷 이력"
        emptyMessage="아직 적재된 스냅샷이 없습니다."
      />
    </Card>
  )
}
