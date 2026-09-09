'use server'

import { revalidatePath } from 'next/cache'

import { actionFailure, logFailure } from '@/lib/actions/action-failure'
import { readField, type FormState } from '@/lib/actions/form-state'
import { writeAuditLog } from '@/lib/audit'
import { requireAdmin } from '@/lib/auth/require-admin'
import { getRankingSnapshots } from '@/lib/data/rankings'
import { CLIENT_CACHE_TAGS, revalidateClient } from '@/lib/revalidate'
import { createClient } from '@/lib/supabase/server'
import {
  isRankType,
  SNAPSHOT_RETENTION,
  type RankingUploadRow,
  type RankType,
} from '@/lib/validation/rankings'

/**
 * 랭킹 스냅샷 되돌리기.
 *
 * 스냅샷 적재는 개발팀 연동(게임 데이터)이 맡는다. 관리자에서 남은 쓰기는
 * **이전 스냅샷으로 되돌리기** 하나뿐이다.
 *
 * **중요 — 원자성.** 스냅샷 교체는 "지우고 넣기"가 아니라 "새 스냅샷을 넣고 오래된
 * 것을 정리하기"로 구현했다. PostgREST 에는 여러 문장을 한 트랜잭션으로 묶는 방법이
 * 없어서, 먼저 지우면 실패했을 때 랭킹이 통째로 빈 상태가 남는다. 사용자 사이트는
 * 언제나 **가장 최근 snapshot_at** 만 읽으므로(lib/data/rankings.ts), 새 스냅샷이
 * 완전히 들어간 순간 교체가 끝난 것과 같다.
 *
 * 진짜 원자적 교체가 필요하면 `replace_ranking_snapshot(p_rank_type, p_rows jsonb)`
 * 같은 SECURITY DEFINER RPC 가 있어야 한다(README 의 RLS/RPC 갭 참고).
 */

const LIST_PATH = '/rankings'

/**
 * 사용자 사이트의 랭킹 표는 `unstable_cache`(60초)다. 되돌린 직후 태우지 않으면
 * 관리자 화면과 사용자 화면이 최대 1분간 다른 표를 보여 준다.
 */
async function revalidateRankings(): Promise<void> {
  revalidatePath(LIST_PATH)
  await revalidateClient([CLIENT_CACHE_TAGS.rankings])
}

/** 한 번에 보내는 행 수. 100건짜리 스냅샷도 한 요청에 다 실리지만 상한을 둔다. */
const CHUNK_SIZE = 500

type ApplyResult = { error: string } | { inserted: number; snapshotAt: string }

/** 새 스냅샷 삽입 + 오래된 스냅샷 정리. 삽입이 깨지면 넣던 것을 되돌린다. */
async function insertSnapshot(
  rankType: RankType,
  rows: readonly RankingUploadRow[],
): Promise<ApplyResult> {
  const supabase = await createClient()
  const snapshotAt = new Date().toISOString()

  for (let index = 0; index < rows.length; index += CHUNK_SIZE) {
    const chunk = rows.slice(index, index + CHUNK_SIZE).map((row) => ({
      ...row,
      rank_type: rankType,
      snapshot_at: snapshotAt,
    }))

    const { error } = await supabase.from('rankings').insert(chunk)

    if (error !== null) {
      // 반쪽짜리 스냅샷이 최신으로 남으면 사용자 사이트의 랭킹이 잘린 채 보인다.
      await supabase
        .from('rankings')
        .delete()
        .eq('rank_type', rankType)
        .eq('snapshot_at', snapshotAt)

      return {
        error: logFailure(
          'rankings',
          '랭킹을 적용하지 못했습니다. 기존 랭킹은 그대로입니다. 다시 시도해 주세요.',
          error,
        ),
      }
    }
  }

  await pruneSnapshots(rankType)

  return { inserted: rows.length, snapshotAt }
}

async function pruneSnapshots(rankType: RankType): Promise<void> {
  const snapshots = await getRankingSnapshots(rankType)
  const stale = snapshots.slice(SNAPSHOT_RETENTION).map((snapshot) => snapshot.snapshotAt)

  if (stale.length === 0) {
    return
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('rankings')
    .delete()
    .eq('rank_type', rankType)
    .in('snapshot_at', stale)

  if (error !== null) {
    // 정리 실패는 적용을 되돌릴 이유가 아니다. 최신 스냅샷은 이미 올바르다.
    console.error('[rankings] 오래된 스냅샷 정리 실패', error.message)
  }
}

function readRankType(formData: FormData): RankType | null {
  const value = readField(formData, 'rankType')

  return isRankType(value) ? value : null
}

/**
 * 롤백 = 과거 스냅샷 다시 적용.
 *
 * 과거 행을 "현재"로 되돌리는 대신 **같은 내용으로 새 스냅샷을 만든다**. 이력을
 * 고쳐 쓰면 "언제 무엇을 되돌렸는지"가 사라져 감사 로그와 이력이 어긋난다.
 */
export async function rollbackRankingSnapshotAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const actor = await requireAdmin()
  const rankType = readRankType(formData)
  const snapshotAt = readField(formData, 'snapshotAt')

  if (rankType === null || snapshotAt === '') {
    return { formError: '되돌릴 스냅샷을 찾을 수 없습니다.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('rankings')
    .select('rank, character_name, level, job, job_group, guild, exp, avatar_url')
    .eq('rank_type', rankType)
    .eq('snapshot_at', snapshotAt)
    .order('rank', { ascending: true })

  if (error !== null) {
    return actionFailure(
      'rankings',
      '스냅샷을 읽지 못했습니다. 목록을 새로고침한 뒤 다시 시도해 주세요.',
      error,
    )
  }

  if (data.length === 0) {
    return { formError: '이미 정리된 스냅샷입니다.' }
  }

  const result = await insertSnapshot(rankType, data)

  if ('error' in result) {
    return { formError: result.error }
  }

  await writeAuditLog(actor.id, {
    action: 'rankings.snapshot.rollback',
    targetTable: 'rankings',
    targetId: `${rankType}@${result.snapshotAt}`,
    before: { rank_type: rankType, snapshot_at: snapshotAt },
    after: { rank_type: rankType, snapshot_at: result.snapshotAt, rows: result.inserted },
  })

  await revalidateRankings()

  return { message: `${result.inserted}건을 되돌렸습니다.` }
}
