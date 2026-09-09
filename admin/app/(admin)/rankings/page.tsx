import Link from 'next/link'

import { SnapshotHistory } from '@/components/rankings/SnapshotHistory'
import { Badge } from '@/components/ui/Badge'
import { Card, CardHeader } from '@/components/ui/Card'
import { PageHeader } from '@/components/ui/PageHeader'
import { Table, type Column } from '@/components/ui/Table'
import { getLatestSnapshotAt, getRankingRows, getRankingSnapshots } from '@/lib/data/rankings'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format-date'
import { firstValue } from '@/lib/utils/table-query'
import { DEFAULT_RANK_TYPE, isRankType, jobGroupLabel, RANK_TYPES } from '@/lib/validation/rankings'

import type { RankingRow } from '@/lib/data/rankings'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '랭킹',
}

/* 되돌린 직후 옛 스냅샷이 보이면 운영자가 같은 조작을 다시 한다. */
export const dynamic = 'force-dynamic'

export default async function RankingsPage(props: PageProps<'/rankings'>) {
  const searchParams = await props.searchParams
  const rawType = firstValue(searchParams.type) ?? ''
  const rankType = isRankType(rawType) ? rawType : DEFAULT_RANK_TYPE
  const viewing = firstValue(searchParams.snapshot)

  const [snapshots, latest] = await Promise.all([
    getRankingSnapshots(rankType),
    getLatestSnapshotAt(rankType),
  ])
  const target = viewing ?? latest
  const rows = await getRankingRows(rankType, target)

  const columns: readonly Column<RankingRow>[] = [
    {
      key: 'rank',
      header: '순위',
      align: 'right',
      className: 'w-20',
      cell: (row) => <span className="font-semibold">{row.rank}</span>,
    },
    {
      key: 'character',
      header: '캐릭터',
      cell: (row) => (
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">{row.characterName}</span>
          <span className="text-muted text-[12px]">{jobGroupLabel(row.jobGroup)}</span>
        </span>
      ),
    },
    {
      key: 'level',
      header: '레벨',
      align: 'right',
      className: 'w-24',
      cell: (row) => <span>Lv. {row.level}</span>,
    },
    { key: 'job', header: '직업', className: 'w-40', cell: (row) => <span>{row.job}</span> },
    {
      key: 'guild',
      header: '길드',
      className: 'w-40',
      cell: (row) => <span className="text-muted">{row.guild ?? '-'}</span>,
    },
    {
      key: 'exp',
      header: '경험치',
      align: 'right',
      className: 'w-32',
      cell: (row) => <span className="text-muted">{row.exp ?? '-'}</span>,
    },
  ]

  const isPast = target !== null && latest !== null && target !== latest

  return (
    <>
      <PageHeader
        title="랭킹"
        description="사용자 사이트는 가장 최근 스냅샷만 읽습니다. 스냅샷은 개발팀 연동(게임 데이터)으로 적재되며, 이 화면에서는 현재 표를 확인하고 이전 스냅샷으로 되돌릴 수 있습니다."
      />

      <nav aria-label="랭킹 종류" className="border-line mb-4 flex gap-1 border-b">
        {RANK_TYPES.map((candidate) => {
          const isActive = candidate.value === rankType

          return (
            <Link
              key={candidate.value}
              href={`/rankings?type=${candidate.value}`}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-t-panel focus-visible:outline-focus -mb-px border-b-2 px-4 py-2.5 text-[14px] font-semibold focus-visible:outline-2 focus-visible:-outline-offset-2',
                isActive
                  ? 'border-accent text-accent-strong'
                  : 'text-muted hover:text-ink border-transparent',
              )}
            >
              {candidate.label}
            </Link>
          )
        })}
      </nav>

      <Card className="mb-6">
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              {isPast ? '과거 스냅샷' : '현재 스냅샷'}
              {isPast && <Badge tone="warn">사이트에 보이는 표가 아닙니다</Badge>}
            </span>
          }
          description={
            target === null
              ? '아직 적재된 랭킹이 없습니다.'
              : `${formatDateTime(target)} · ${rows.length}건`
          }
          action={
            isPast ? (
              <Link
                href={`/rankings?type=${rankType}`}
                className="text-accent-strong text-[13px] font-semibold hover:underline"
              >
                현재 스냅샷 보기
              </Link>
            ) : undefined
          }
        />
        <Table
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.id}
          caption="랭킹 목록"
          emptyMessage="표시할 랭킹이 없습니다."
        />
      </Card>

      <SnapshotHistory
        rankType={rankType}
        snapshots={snapshots}
        currentSnapshot={latest}
        viewing={viewing}
      />
    </>
  )
}
