import { z } from 'zod'

import { parseCsvTable } from '@/lib/utils/csv'

import type { Enums } from '@/lib/supabase/types'

/**
 * 랭킹 CSV 스키마와 검증.
 *
 * 랭킹은 한 건씩 고치지 않고 **스냅샷 통째로** 갈아 끼운다. 그래서 검증도 행
 * 단위가 아니라 파일 단위다 — 한 행이 잘못되면 그 행만 빠지는 것이 아니라 전체를
 * 반려한다. 순위가 하나 빠진 표는 "부분 성공"이 아니라 그냥 틀린 표다.
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

export function rankTypeLabel(value: string): string {
  return RANK_TYPES.find((candidate) => candidate.value === value)?.label ?? value
}

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

export const DEFAULT_JOB_GROUP: JobGroup = 'adventurer'

export function jobGroupLabel(value: string): string {
  return JOB_GROUPS.find((candidate) => candidate.value === value)?.label ?? value
}

/**
 * 직업군 추정표.
 *
 * `rankings.job_group` 은 NOT NULL 인데 운영에서 받는 CSV 에는 직업군 열이 없는
 * 경우가 많다. 열이 있으면 그 값을 그대로 쓰고, 없을 때만 이 표로 채운다.
 * 표에 없으면 모험가로 떨어뜨린다 — 업로드를 막을 만큼 중요한 값이 아니다.
 */
const JOBS_BY_GROUP: Record<JobGroup, readonly string[]> = {
  adventurer: [
    '히어로',
    '팔라딘',
    '다크나이트',
    '비숍',
    '보우마스터',
    '신궁',
    '나이트로드',
    '섀도어',
    '듀얼블레이더',
    '바이퍼',
    '캡틴',
    '캐논마스터',
  ],
  cygnus: ['소울마스터', '플레임위자드', '윈드브레이커', '나이트워커', '스트라이커', '미하일'],
  resistance: ['블래스터', '배틀메이지', '와일드헌터', '메카닉', '제논'],
  hero: ['아란', '에반', '루미너스', '메르세데스', '팬텀', '은월'],
  demon: ['데몬슬레이어', '데몬어벤져'],
}

export function inferJobGroup(job: string): JobGroup {
  const needle = job.replaceAll(' ', '')
  const entries = Object.entries(JOBS_BY_GROUP) as readonly [JobGroup, readonly string[]][]

  return entries.find(([, jobs]) => jobs.includes(needle))?.[0] ?? DEFAULT_JOB_GROUP
}

const positiveIntSchema = (label: string) =>
  z
    .string()
    .trim()
    .refine((value) => /^\d+$/.test(value), `${label}은(는) 정수로 입력해 주세요.`)
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => value >= 1, `${label}은(는) 1 이상이어야 합니다.`)

export const RANKING_CSV_HEADERS = [
  'rank',
  'character_name',
  'level',
  'job',
  'job_group',
  'guild',
  'exp',
  'avatar_url',
] as const

/** 직업군·길드·경험치·아바타는 없어도 된다. 없으면 추정하거나 비워 둔다. */
export const RANKING_CSV_REQUIRED_HEADERS = ['rank', 'character_name', 'level', 'job'] as const

export const rankingCsvRowSchema = z.object({
  rank: positiveIntSchema('순위'),
  character_name: z.string().trim().min(1, '캐릭터명이 비어 있습니다.').max(50),
  level: positiveIntSchema('레벨').refine((value) => value <= 999, '레벨은 999 이하여야 합니다.'),
  job: z.string().trim().min(1, '직업이 비어 있습니다.').max(50),
  job_group: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || jobGroupSchema.safeParse(value).success,
      `직업군은 ${JOB_GROUP_VALUES_TUPLE.join(' / ')} 중 하나여야 합니다.`,
    )
    .default(''),
  guild: z.string().trim().max(50).default(''),
  exp: z.string().trim().max(30).default(''),
  avatar_url: z
    .string()
    .trim()
    .refine(
      (value) => value === '' || value.startsWith('/') || /^https?:\/\//.test(value),
      '아바타는 http(s) URL 이거나 `/` 로 시작하는 경로여야 합니다.',
    )
    .default(''),
})

/** DB 에 그대로 넣을 수 있는 모양(스냅샷 시각은 적용 시점에 붙인다). */
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

export type RankingCsvIssue = {
  /** 파일에서의 줄 번호. 0 이면 파일 전체에 대한 오류다. */
  line: number
  message: string
}

export type RankingCsvPreview = {
  rows: readonly RankingUploadRow[]
  issues: readonly RankingCsvIssue[]
  isValid: boolean
}

/** 파싱된 레코드 → 업로드 행. 행별 오류만 본다(파일 전체 규칙은 아래에서). */
function toUploadRow(values: Record<string, string>): {
  row: RankingUploadRow | null
  messages: readonly string[]
} {
  const parsed = rankingCsvRowSchema.safeParse(values)

  if (!parsed.success) {
    return { row: null, messages: parsed.error.issues.map((issue) => issue.message) }
  }

  const data = parsed.data
  /* 열이 없거나 비어 있으면 safeParse 가 실패한다. 그때만 직업명으로 추정한다. */
  const parsedGroup = jobGroupSchema.safeParse(data.job_group)

  return {
    row: {
      rank: data.rank,
      character_name: data.character_name,
      level: data.level,
      job: data.job,
      job_group: parsedGroup.success ? parsedGroup.data : inferJobGroup(data.job),
      guild: data.guild === '' ? null : data.guild,
      exp: data.exp === '' ? null : data.exp,
      avatar_url: data.avatar_url === '' ? null : data.avatar_url,
    },
    messages: [],
  }
}

/**
 * CSV 텍스트 → 미리보기.
 *
 * 미리보기와 실제 적용이 **같은 함수**를 쓴다. 브라우저에서 통과한 파일이 서버에서
 * 다르게 해석되면 미리보기는 의미가 없다.
 */
export function validateRankingCsv(text: string): RankingCsvPreview {
  const table = parseCsvTable(text, RANKING_CSV_REQUIRED_HEADERS)

  if (table.error !== null) {
    return { rows: [], issues: [{ line: 0, message: table.error }], isValid: false }
  }

  if (table.records.length === 0) {
    return { rows: [], issues: [{ line: 0, message: '데이터 행이 없습니다.' }], isValid: false }
  }

  const issues: RankingCsvIssue[] = []
  const entries: { line: number; row: RankingUploadRow }[] = []

  for (const record of table.records) {
    const { row, messages } = toUploadRow(record.values)

    if (row === null) {
      for (const message of messages) {
        issues.push({ line: record.line, message })
      }

      continue
    }

    entries.push({ line: record.line, row })
  }

  issues.push(...rankSequenceIssues(entries))

  const rows = entries.map((entry) => entry.row)

  return { rows, issues, isValid: issues.length === 0 }
}

/**
 * 순위 규칙: 1부터 빈칸 없이, 중복 없이.
 *
 * 캐릭터명 중복은 오류가 아니다 — 동명이인이 실제로 존재하고, 시드 데이터에도 있다.
 */
function rankSequenceIssues(
  entries: readonly { line: number; row: RankingUploadRow }[],
): readonly RankingCsvIssue[] {
  const issues: RankingCsvIssue[] = []
  const seen = new Map<number, number>()

  for (const { line, row } of entries) {
    const previous = seen.get(row.rank)

    if (previous !== undefined) {
      issues.push({ line, message: `순위 ${row.rank} 이(가) ${previous}번째 줄과 중복됩니다.` })

      continue
    }

    seen.set(row.rank, line)
  }

  const sorted = [...new Set(entries.map((entry) => entry.row.rank))].sort(
    (left, right) => left - right,
  )
  const missing = sorted.findIndex((rank, index) => rank !== index + 1)

  if (missing !== -1) {
    issues.push({
      line: 0,
      message: `순위는 1부터 빈칸 없이 이어져야 합니다. (${missing + 1}위가 없습니다)`,
    })
  }

  return issues
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
