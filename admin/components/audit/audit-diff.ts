import type { Json } from '@/types/database.types'

/**
 * 감사 로그의 before/after 를 사람이 읽는 형태로 바꾸는 순수 헬퍼.
 *
 * 조회 계층(`lib/data/audit.ts`)이 아니라 여기에 두는 이유: 그쪽은 `server-only`
 * 라 단위 테스트에서 import 조차 되지 않는다. 요약·마스킹은 **표시 규칙**이므로
 * 화면 옆에 두고 테스트한다.
 */

export const REDACTED = '***'

/** 이름에 이 단어가 들어간 필드는 값 자체를 남기지 않는다. */
const SENSITIVE_KEY = /pass(word)?|token|secret|api[-_]?key/i

/**
 * 민감 필드 마스킹.
 *
 * 값이 아니라 **키 이름**으로 판단한다. 값으로 판단하려 들면(예: JWT 처럼 생긴
 * 문자열) 새 형식이 생길 때마다 규칙이 새고, 한 번 새면 로그에 영구히 남는다.
 */
export function redactSensitive(value: Json): Json {
  if (Array.isArray(value)) {
    return value.map(redactSensitive)
  }

  if (value === null || typeof value !== 'object') {
    return value
  }

  const result: Record<string, Json> = {}

  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) {
      continue
    }

    result[key] = SENSITIVE_KEY.test(key) ? REDACTED : redactSensitive(entry)
  }

  return result
}

/** 펼침 영역에 그리는 전체 JSON. 마스킹을 거친 뒤 들여쓴다. */
export function formatAuditJson(value: Json | null): string {
  if (value === null) {
    return '-'
  }

  return JSON.stringify(redactSensitive(value), null, 2)
}

export type AuditFieldChange = {
  key: string
  before: string | null
  after: string | null
}

const MAX_VALUE_LENGTH = 40

/** 표 한 칸에 들어가야 하므로 값은 짧게 줄인다. 자른 값은 말줄임표로 표시한다. */
function toShortText(value: Json | undefined): string | null {
  if (value === undefined || value === null) {
    return null
  }

  if (typeof value === 'object') {
    return Array.isArray(value) ? `[${value.length}건]` : '{…}'
  }

  const text = String(value)

  return text.length > MAX_VALUE_LENGTH ? `${text.slice(0, MAX_VALUE_LENGTH)}…` : text
}

function toRecord(value: Json | null): { [key: string]: Json | undefined } | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  return value
}

/**
 * 바뀐 키만 골라낸다.
 *
 * 한쪽이 객체가 아니면(생성·삭제 로그는 before 나 after 가 통째로 비어 있다)
 * 있는 쪽의 키를 전부 변화로 본다 — "무엇이 생겼는가"가 그 로그의 내용이다.
 */
export function diffAuditRecords(
  before: Json | null,
  after: Json | null,
): readonly AuditFieldChange[] {
  const redactedBefore = before === null ? null : redactSensitive(before)
  const redactedAfter = after === null ? null : redactSensitive(after)
  const beforeRecord = toRecord(redactedBefore)
  const afterRecord = toRecord(redactedAfter)

  if (beforeRecord === null && afterRecord === null) {
    return []
  }

  const keys = [...new Set([...Object.keys(beforeRecord ?? {}), ...Object.keys(afterRecord ?? {})])]

  return keys
    .map((key) => ({
      key,
      before: toShortText(beforeRecord?.[key]),
      after: toShortText(afterRecord?.[key]),
    }))
    .filter((change) => change.before !== change.after)
}

const MAX_SUMMARY_KEYS = 3

/** 목록의 "변경 요약" 칸. 세 개까지만 적고 나머지는 건수로 줄인다. */
export function summarizeAuditDiff(before: Json | null, after: Json | null): string {
  const changes = diffAuditRecords(before, after)

  if (changes.length === 0) {
    return '-'
  }

  const shown = changes.slice(0, MAX_SUMMARY_KEYS).map((change) => {
    if (change.before === null) {
      return `${change.key}: ${change.after}`
    }

    if (change.after === null) {
      return `${change.key}: ${change.before} → (없음)`
    }

    return `${change.key}: ${change.before} → ${change.after}`
  })

  const rest = changes.length - shown.length

  return rest > 0 ? `${shown.join(', ')} 외 ${rest}건` : shown.join(', ')
}
