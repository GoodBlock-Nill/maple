import { ListSheet } from '@/components/board/ListSheet'
import { RANKING_GRID_CLASS, RankingRow } from '@/components/ranking/RankingRow'
import { RANKING_COLUMNS } from '@/lib/constants/ranking'
import { cn } from '@/lib/utils/cn'

import type { RankedEntry } from '@/types/domain'

type RankingTableProps = {
  rows: readonly RankedEntry[]
}

/**
 * 4위부터의 랭킹 표. 헤더는 데스크톱에서만 노출되며(모바일은 카드형 행이
 * 라벨을 직접 갖는다) 각 행의 값에는 sr-only 라벨이 붙어 있다.
 */
export function RankingTable({ rows }: RankingTableProps) {
  return (
    /* 시안: TOP3 영역 아래 53px 부터 표 시트가 시작한다. */
    <ListSheet className="mt-10 xl:mt-[53px]">
      <div
        aria-hidden
        className={cn(RANKING_GRID_CLASS, 'hidden h-[45px] items-center px-4 sm:px-6 lg:grid lg:px-0 lg:pr-4')}
      >
        {RANKING_COLUMNS.map((column) => (
          <p
            key={column.key}
            className="text-ink-muted text-center text-[17px] leading-none font-medium"
          >
            {column.label}
          </p>
        ))}
      </div>

      <ol className="flex flex-col gap-3">
        {rows.map((entry) => (
          <RankingRow key={entry.id} entry={entry} />
        ))}
      </ol>
    </ListSheet>
  )
}
