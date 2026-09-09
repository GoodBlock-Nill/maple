import { z } from 'zod'

import type { Enums } from '@/lib/supabase/types'

/**
 * 랭킹 종류 · 직업군 어휘.
 *
 * 랭킹은 한 건씩 고치지 않고 **스냅샷 통째로** 적재된다. 적재는 개발팀 연동(게임
 * 데이터)이 맡고 관리자는 현재 표를 확인하거나 이전 스냅샷으로 되돌리기만 한다.
 * 그래서 이 모듈에는 화면이 읽는 어휘와 되돌리기가 쓰는 행 모양만 남는다.
 */

const RANK_TYPE_VALUES_TUPLE = [
  'total',
  'job',
  'guild',
] as const satisfies readonly Enums<'ranking_type'>[]

export const rankTypeSchema = z.enum(RANK_TYPE_VALUES_TUPLE)

export type RankType = z.infer<typeof rankTypeSchema>

export const RANK_TYPE_VALUES: readonly RankType[] = RANK_TYPE_VALUES_TUPLE

export const RANK_TYPES: readonly { value: RankType; label: string }[] = [
  { value: 'total', label: '종합 랭킹' },
  { value: 'job', label: '직업 랭킹' },
  { value: 'guild', label: '길드 랭킹' },
]

export const DEFAULT_RANK_TYPE: RankType = 'total'

export function isRankType(value: string): value is RankType {
  return RANK_TYPE_VALUES.includes(value as RankType)
}

const JOB_GROUP_VALUES_TUPLE = [
  'adventurer',
  'cygnus',
  'resistance',
  'hero',
  'demon',
] as const satisfies readonly Enums<'job_group'>[]

export const jobGroupSchema = z.enum(JOB_GROUP_VALUES_TUPLE)

export type JobGroup = z.infer<typeof jobGroupSchema>

export const JOB_GROUPS: readonly { value: JobGroup; label: string }[] = [
  { value: 'adventurer', label: '모험가' },
  { value: 'cygnus', label: '시그너스' },
  { value: 'resistance', label: '레지스탕스' },
  { value: 'hero', label: '영웅' },
  { value: 'demon', label: '데몬(마족)' },
]

export function jobGroupLabel(value: string): string {
  return JOB_GROUPS.find((candidate) => candidate.value === value)?.label ?? value
}

/**
 * 되돌리기가 다시 넣는 행 모양(스냅샷 시각은 적용 시점에 붙인다).
 *
 * 적재 자체는 개발팀 연동이 하지만, 되돌리기는 과거 스냅샷을 읽어 **같은 내용의 새
 * 스냅샷**으로 다시 넣는다. 그 왕복이 통과할 열 구성을 여기 한곳에 고정해 둔다.
 */
export type RankingUploadRow = {
  rank: number
  character_name: string
  level: number
  job: string
  job_group: JobGroup
  guild: string | null
  exp: string | null
  avatar_url: string | null
}

/**
 * rank_type 당 보관하는 스냅샷 수.
 *
 * 이력이 없으면 되돌릴 수 없고, 무한정 쌓이면 이력 조회가 느려진다. 최근 5벌이면
 * "직전으로 되돌리기"와 "지난주 표 확인"을 모두 덮는다.
 *
 * 서버 액션 파일이 아니라 여기에 둔다 — `'use server'` 모듈은 async 함수만
 * export 할 수 있어서 상수를 두면 빌드가 깨진다.
 */
export const SNAPSHOT_RETENTION = 5
