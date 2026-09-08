import { z } from 'zod'

import type { LegalVersionStatus } from '@/lib/constants/legal'

/**
 * 약관 개정본 폼 스키마와 "현재 시행본" 판정.
 *
 * 서버 액션이 클라이언트 검증을 신뢰하지 않고 다시 파싱한다(액션은 UI 를 거치지
 * 않는 직접 POST 로도 호출된다).
 *
 * 날짜는 전부 **한국 시간의 달력 날짜**로 다룬다. `effective_date` 는 시각이 없는
 * `date` 컬럼이라 UTC 로 해석하면 한국 자정~오전 9시 사이에 하루가 밀린다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

/** 한국 시간 기준 오늘(`2026-09-09`). */
export function kstToday(now: Date = new Date()): string {
  return new Date(now.getTime() + KST_OFFSET_MS).toISOString().slice(0, 10)
}

/** 새 개정본의 기본 버전 = 오늘 날짜(`20260909`). */
export function defaultLegalVersion(now: Date = new Date()): string {
  return kstToday(now).replace(/-/gu, '')
}

/** DB 의 `legal_document_versions_version_format` 과 같은 규칙이다. */
const VERSION_PATTERN = /^\d{8}(-\d{1,2})?$/u
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/u

/** 달력에 실제로 있는 날짜인지. `2026-02-31` 같은 오타를 여기서 끊는다. */
export function isCalendarDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value)

  if (match === null) {
    return false
  }

  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  )
}

/**
 * `2026-09-18` → `2026년 9월 18일`.
 *
 * 사용자 사이트 `lib/data/legal.ts` 의 같은 이름 함수와 결과가 한 글자도 달라선
 * 안 된다 — 미리보기의 시행일 알약이 독자 화면과 다르면 무엇을 발행하는지 알 수
 * 없다. `new Date()` 를 쓰지 않는 이유도 같다(시각 없는 date 는 UTC 자정으로
 * 해석되어 한국 시간으로 되돌리면 하루가 밀린다).
 */
export function formatEffectiveDate(isoDate: string): string {
  const match = DATE_PATTERN.exec(isoDate.trim())

  if (match === null) {
    return isoDate
  }

  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`
}

export const LEGAL_PUBLISH_MODES = ['draft', 'publish', 'schedule'] as const

export type LegalPublishMode = (typeof LEGAL_PUBLISH_MODES)[number]

export const legalFormSchema = z
  .object({
    version: z
      .string()
      .trim()
      .regex(VERSION_PATTERN, '버전은 YYYYMMDD 형식입니다(같은 날 재개정은 20260909-2).'),
    effectiveDate: z.string().trim().refine(isCalendarDate, '시행일을 올바르게 입력해 주세요.'),
    summary: z.string().trim().max(200, '변경 요약은 200자를 넘을 수 없습니다.'),
    content: z.string().trim().min(1, '본문을 입력해 주세요.'),
    publishMode: z.enum(LEGAL_PUBLISH_MODES, { message: '발행 상태를 선택해 주세요.' }),
  })
  .superRefine((value, ctx) => {
    const today = kstToday()

    /* 예약은 "아직 시행일이 오지 않은 발행본"이다. 시행일이 오늘 이하인데 예약으로
       저장하면 저장 즉시 노출되어, 운영자가 의도한 것과 결과가 달라진다. */
    if (value.publishMode === 'schedule' && value.effectiveDate <= today) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveDate'],
        message: '예약하려면 시행일이 오늘보다 뒤여야 합니다.',
      })
    }

    if (value.publishMode === 'publish' && value.effectiveDate > today) {
      ctx.addIssue({
        code: 'custom',
        path: ['effectiveDate'],
        message: '시행일이 미래입니다. 예약을 선택해 주세요.',
      })
    }
  })

export type LegalFormInput = z.infer<typeof legalFormSchema>

export type LegalPublishPlan = {
  isPublished: boolean
  /** 발행 시각. 임시저장이면 null 이다(DB 체크 제약과 짝). */
  publishedAt: string | null
}

/**
 * 발행 설정 → DB 두 컬럼.
 *
 * 예약도 `is_published = true` 다. 노출 여부를 가르는 것은 `effective_date` 뿐이고,
 * 그 판정은 `current_legal_version()` 한 곳에만 둔다 — 발행 플래그와 시행일 두
 * 군데서 각각 거르면 "발행했는데 안 보이는" 원인을 추적할 수 없다.
 */
export function resolveLegalPublishPlan(
  mode: LegalPublishMode,
  now: Date = new Date(),
): LegalPublishPlan {
  return mode === 'draft'
    ? { isPublished: false, publishedAt: null }
    : { isPublished: true, publishedAt: now.toISOString() }
}

/** 현재 시행본 판정에 필요한 최소 정보. DB 행에서 그대로 뽑아 쓴다. */
export type LegalVersionLike = {
  version: string
  effectiveDate: string
  isPublished: boolean
  publishedAt: string | null
}

/**
 * "지금 시행 중인 개정본" — SQL `current_legal_version()` 과 **같은 규칙**이다.
 *
 * 관리자 목록이 자체 규칙으로 고르면 사용자 화면과 다른 버전을 "현재"라고 부르게
 * 된다. 규칙을 두 번 적는 대신, 여기 순수 함수를 단위 테스트로 못 박아 SQL 과
 * 나란히 둔다.
 *
 *  1) 발행본 중 시행일이 오늘 이하 → 시행일이 가장 늦은 것(같으면 늦게 발행한 것).
 *  2) 그런 것이 없으면 → 가장 최근에 발행한 것.
 */
export function selectCurrentLegalVersion<T extends LegalVersionLike>(
  versions: readonly T[],
  today: string = kstToday(),
): T | null {
  const published = versions.filter((version) => version.isPublished)
  const effective = published.filter((version) => version.effectiveDate <= today)
  const pool = effective.length > 0 ? effective : published

  if (pool.length === 0) {
    return null
  }

  return [...pool].sort((left, right) => {
    if (effective.length > 0 && left.effectiveDate !== right.effectiveDate) {
      return left.effectiveDate < right.effectiveDate ? 1 : -1
    }

    return (right.publishedAt ?? '').localeCompare(left.publishedAt ?? '')
  })[0] as T
}

/** 개정본 하나의 화면 상태. `currentVersion` 은 위 함수가 고른 값이다. */
export function deriveLegalStatus(
  version: LegalVersionLike,
  currentVersion: string | null,
  today: string = kstToday(),
): LegalVersionStatus {
  if (!version.isPublished) {
    return 'draft'
  }

  if (version.effectiveDate > today) {
    return 'scheduled'
  }

  return version.version === currentVersion ? 'published' : 'superseded'
}
