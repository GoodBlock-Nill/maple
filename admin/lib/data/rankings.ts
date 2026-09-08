import 'server-only'

import { createClient } from '@/lib/supabase/server'

import type { JobGroup, RankType } from '@/lib/validation/rankings'

/**
 * 랭킹 조회 (`rankings`).
 *
 * 랭킹은 스냅샷 단위로 통째로 적재된다(마이그레이션 주석). 따라서 "현재 랭킹" =
 * 해당 rank_type 의 **가장 최근 snapshot_at** 이고, 그보다 오래된 스냅샷은 이력이다.
 */

export type RankingRow = {
  id: string
  rank: number
  characterName: string
  level: number
  job: string
  jobGroup: JobGroup
  guild: string | null
  exp: string | null
  avatarUrl: string | null
  snapshotAt: string
}

export type SnapshotSummary = {
  snapshotAt: string
  count: number
}

const COLUMNS =
  'id, rank, character_name, level, job, job_group, guild, exp, avatar_url, snapshot_at'

/**
 * 스냅샷 이력을 만들기 위해 훑는 최대 행 수.
 *
 * PostgREST 는 group by 를 노출하지 않아 `snapshot_at` 만 뽑아 와 앱에서 센다.
 * 한 스냅샷이 100건 안팎이므로 5000 이면 최근 수십 벌을 덮는다. 이 한도를 넘길
 * 만큼 이력이 쌓이면 집계 뷰(또는 RPC)를 만들어야 한다.
 */
const SNAPSHOT_SCAN_LIMIT = 5000

export async function getRankingSnapshots(rankType: RankType): Promise<readonly SnapshotSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rankings')
    .select('snapshot_at')
    .eq('rank_type', rankType)
    .order('snapshot_at', { ascending: false })
    .limit(SNAPSHOT_SCAN_LIMIT)

  if (error !== null) {
    console.error('[rankings] 스냅샷 이력 조회 실패', error.message)

    return []
  }

  const counts = new Map<string, number>()

  for (const row of data) {
    counts.set(row.snapshot_at, (counts.get(row.snapshot_at) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([snapshotAt, count]) => ({ snapshotAt, count }))
    .sort((left, right) => right.snapshotAt.localeCompare(left.snapshotAt))
}

export async function getLatestSnapshotAt(rankType: RankType): Promise<string | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rankings')
    .select('snapshot_at')
    .eq('rank_type', rankType)
    .order('snapshot_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error !== null || data === null) {
    return null
  }

  return data.snapshot_at
}

/** 지정한 스냅샷(없으면 최신)의 전체 순위. 순위 오름차순이다. */
export async function getRankingRows(
  rankType: RankType,
  snapshotAt: string | null,
): Promise<readonly RankingRow[]> {
  const target = snapshotAt ?? (await getLatestSnapshotAt(rankType))

  if (target === null) {
    return []
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rankings')
    .select(COLUMNS)
    .eq('rank_type', rankType)
    .eq('snapshot_at', target)
    .order('rank', { ascending: true })

  if (error !== null) {
    console.error('[rankings] 목록 조회 실패', error.message)

    return []
  }

  return data.map((row) => ({
    id: row.id,
    rank: row.rank,
    characterName: row.character_name,
    level: row.level,
    job: row.job,
    jobGroup: row.job_group,
    guild: row.guild,
    exp: row.exp,
    avatarUrl: row.avatar_url,
    snapshotAt: row.snapshot_at,
  }))
}
