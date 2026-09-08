import { unstable_cache } from 'next/cache'

import { DEFAULT_RANKING_TYPE, RANKING_PAGE_SIZE, TOP_RANK_COUNT } from '@/lib/constants/ranking'
import { CACHE_TAGS, LIST_REVALIDATE_SECONDS } from '@/lib/data/cache'
import { toRankingEntry } from '@/lib/data/mappers'
import { accumulatedRange, containsPattern } from '@/lib/data/query'
import { createPublicClient } from '@/lib/supabase/public'
import { accumulatedCount } from '@/lib/utils/pagination'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type {
  JobGroup,
  RankedEntry,
  RankingListParams,
  RankingListResult,
  RankingType,
} from '@/types/domain'

/**
 * 랭킹 데이터 접근 계층 (`rankings`).
 *
 * 모집단은 **항상 `rank_type = 'total'` 의 최신 스냅샷**이다. 랭킹 출처(외부 API vs
 * 관리자 CSV)가 확정되지 않아 직업·길드 스냅샷은 아직 적재되지 않았고, 시안의
 * 세 탭은 같은 모집단을 다르게 좁혀 보여 준다.
 *  - 종합 / 직업: 전체
 *  - 길드: 길드 소속 캐릭터만(미가입자는 순위 대상이 아니다)
 *
 * 순위는 필터링 후 다시 매긴다. 표시 순위 = 정렬된 결과에서의 위치이므로,
 * `rank` 오름차순으로 읽은 다음 인덱스로 번호를 붙이면 된다.
 */

const SOURCE_RANK_TYPE = 'total' satisfies RankingType

/** 길드 랭킹만 모집단을 좁힌다. */
const GUILD_ONLY: Record<RankingType, boolean> = {
  total: false,
  job: false,
  guild: true,
}

/**
 * 가장 최근 스냅샷 시각. 스냅샷이 여러 벌 쌓여도 목록이 섞이지 않게 한다.
 * 행이 하나도 없으면 null 이고, 이 경우 목록은 빈 결과가 된다.
 */
async function getLatestSnapshot(supabase: TypedSupabaseClient): Promise<string | null> {
  const { data, error } = await supabase
    .from('rankings')
    .select('snapshot_at')
    .eq('rank_type', SOURCE_RANK_TYPE)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  return data.snapshot_at
}

const EMPTY_RESULT = (page: number): RankingListResult => ({
  top: [],
  rows: [],
  total: 0,
  shown: 0,
  page,
  hasMore: false,
})

/** 탭·직업·검색 필터를 얹은 목록 쿼리. 정렬은 항상 `rank` 오름차순이다. */
function buildRankingQuery(
  supabase: TypedSupabaseClient,
  snapshot: string,
  type: RankingType,
  job: JobGroup | null,
  q: string,
) {
  let query = supabase
    .from('rankings')
    .select('*', { count: 'exact' })
    .eq('rank_type', SOURCE_RANK_TYPE)
    .eq('snapshot_at', snapshot)

  if (GUILD_ONLY[type]) {
    query = query.not('guild', 'is', null)
  }

  if (job !== null) {
    query = query.eq('job_group', job)
  }

  const pattern = containsPattern(q)

  if (pattern !== null) {
    query = query.ilike('character_name', pattern)
  }

  return query.order('rank', { ascending: true })
}

/** TOP3 카드와 4위부터의 표로 쪼갠다. `total` 은 카드까지 포함한 전체 인원이다. */
function toRankingPage(
  ranked: readonly RankedEntry[],
  count: number | null,
  page: number,
): RankingListResult {
  const total = count ?? ranked.length
  const tableTotal = Math.max(total - TOP_RANK_COUNT, 0)
  const shown = Math.min(
    Math.max(ranked.length - TOP_RANK_COUNT, 0),
    accumulatedCount(page, RANKING_PAGE_SIZE, tableTotal),
  )

  return {
    top: ranked.slice(0, TOP_RANK_COUNT),
    rows: ranked.slice(TOP_RANK_COUNT, TOP_RANK_COUNT + shown),
    total,
    shown,
    page,
    hasMore: shown < tableTotal,
  }
}

async function fetchRankingList(
  type: RankingType,
  job: JobGroup | null,
  q: string,
  page: number,
): Promise<RankingListResult> {
  const supabase = createPublicClient()
  const snapshot = await getLatestSnapshot(supabase)

  if (snapshot === null) {
    return EMPTY_RESULT(page)
  }

  const { from, to } = accumulatedRange(page, RANKING_PAGE_SIZE, TOP_RANK_COUNT)
  const { data, count, error } = await buildRankingQuery(supabase, snapshot, type, job, q).range(
    from,
    to,
  )

  if (error !== null) {
    throw new Error(`랭킹을 불러오지 못했습니다: ${error.message}`)
  }

  // 필터링 뒤 순위를 다시 매긴다. `rank` 오름차순이라 인덱스가 곧 표시 순위다.
  return toRankingPage(
    data.map((row, index) => ({ ...toRankingEntry(row), rank: index + 1 })),
    count,
    page,
  )
}

const getCachedRankingList = unstable_cache(fetchRankingList, ['ranking-list'], {
  tags: [CACHE_TAGS.rankings],
  revalidate: LIST_REVALIDATE_SECONDS,
})

export async function getRankingList({
  type = DEFAULT_RANKING_TYPE,
  job = null,
  q = '',
  page = 1,
}: RankingListParams = {}): Promise<RankingListResult> {
  return getCachedRankingList(type, job, q, page)
}
