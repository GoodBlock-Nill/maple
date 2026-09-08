import { DEFAULT_RANKING_TYPE, RANKING_PAGE_SIZE, TOP_RANK_COUNT } from '@/lib/constants/ranking'
import { RANKING_ENTRIES } from '@/lib/mock/rankings'
import { matchesQuery } from '@/lib/utils/list-query'
import { accumulatedCount } from '@/lib/utils/pagination'

import type {
  RankedEntry,
  RankingEntry,
  RankingListParams,
  RankingListResult,
  RankingType,
} from '@/types/domain'

/**
 * 랭킹 데이터 접근 계층.
 * 목록은 이미 순위대로 정렬된 원본을 받아 필터링 후 순위를 다시 매긴다.
 * Phase 4에서 Supabase `rankings` 쿼리로 교체된다.
 */

/**
 * 랭킹 종류별 모집단.
 * - 종합/직업: 전체 캐릭터
 * - 길드: 길드에 소속된 캐릭터만(미가입자는 순위 대상이 아니다)
 */
const TYPE_FILTERS: Record<RankingType, (entry: RankingEntry) => boolean> = {
  total: () => true,
  job: () => true,
  guild: (entry) => entry.guild !== null,
}

function withRank(entries: readonly RankingEntry[]): readonly RankedEntry[] {
  return entries.map((entry, index) => ({ ...entry, rank: index + 1 }))
}

export async function getRankingList({
  type = DEFAULT_RANKING_TYPE,
  job = null,
  q = '',
  page = 1,
}: RankingListParams = {}): Promise<RankingListResult> {
  const matchesType = TYPE_FILTERS[type]

  const filtered = RANKING_ENTRIES.filter((entry) => {
    if (!matchesType(entry)) {
      return false
    }

    if (job !== null && entry.jobGroup !== job) {
      return false
    }

    return matchesQuery(q, entry.nickname, entry.job, entry.guild ?? '')
  })

  const ranked = withRank(filtered)
  const total = ranked.length
  const tableTotal = Math.max(total - TOP_RANK_COUNT, 0)
  const shown = accumulatedCount(page, RANKING_PAGE_SIZE, tableTotal)

  return {
    top: ranked.slice(0, TOP_RANK_COUNT),
    rows: ranked.slice(TOP_RANK_COUNT, TOP_RANK_COUNT + shown),
    total,
    shown,
    page,
    hasMore: shown < tableTotal,
  }
}
