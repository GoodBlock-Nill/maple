import { describe, expect, it } from 'vitest'

import {
  diffAuditRecords,
  formatAuditJson,
  redactSensitive,
  REDACTED,
  summarizeAuditDiff,
} from '@/components/audit/audit-diff'
import { auditActionLabel, auditTableLabel } from '@/components/audit/audit-labels'

describe('redactSensitive', () => {
  it('should mask fields whose name mentions a password or token', () => {
    expect(
      redactSensitive({ email: 'a@b.co', password: 'hunter2', token_hash: 'abc', apiKey: 'k' }),
    ).toEqual({ email: 'a@b.co', password: REDACTED, token_hash: REDACTED, apiKey: REDACTED })
  })

  it('should match regardless of case', () => {
    expect(redactSensitive({ Password: 'x', ACCESS_TOKEN: 'y' })).toEqual({
      Password: REDACTED,
      ACCESS_TOKEN: REDACTED,
    })
  })

  it('should reach nested objects and arrays', () => {
    expect(redactSensitive({ user: { secret: 'x' }, list: [{ token: 'y' }] })).toEqual({
      user: { secret: REDACTED },
      list: [{ token: REDACTED }],
    })
  })

  it('should leave values whose name is not sensitive', () => {
    // 값의 생김새로 판단하지 않는다 — 토큰처럼 생긴 닉네임까지 가리면 로그를 못 읽는다.
    expect(redactSensitive({ nickname: 'eyJhbGciOi' })).toEqual({ nickname: 'eyJhbGciOi' })
  })

  it('should pass through primitives and null', () => {
    expect(redactSensitive(null)).toBeNull()
    expect(redactSensitive(3)).toBe(3)
  })
})

describe('formatAuditJson', () => {
  it('should pretty print with the sensitive values already masked', () => {
    expect(formatAuditJson({ password: 'x' })).toBe(`{\n  "password": "${REDACTED}"\n}`)
  })

  it('should render a missing side as a dash', () => {
    expect(formatAuditJson(null)).toBe('-')
  })
})

describe('diffAuditRecords', () => {
  it('should list only the keys that changed', () => {
    const changes = diffAuditRecords({ name: '가', probability: 1 }, { name: '가', probability: 2 })

    expect(changes).toEqual([{ key: 'probability', before: '1', after: '2' }])
  })

  it('should treat a missing before as a creation', () => {
    expect(diffAuditRecords(null, { name: '가' })).toEqual([
      { key: 'name', before: null, after: '가' },
    ])
  })

  it('should treat a missing after as a deletion', () => {
    expect(diffAuditRecords({ name: '가' }, null)).toEqual([
      { key: 'name', before: '가', after: null },
    ])
  })

  it('should summarise object and array values instead of dumping them', () => {
    const changes = diffAuditRecords({ rows: [1, 2] }, { rows: [1, 2, 3] })

    expect(changes).toEqual([{ key: 'rows', before: '[2건]', after: '[3건]' }])
  })

  it('should shorten long values', () => {
    const changes = diffAuditRecords({ note: 'a' }, { note: 'b'.repeat(60) })

    expect(changes[0]?.after?.endsWith('…')).toBe(true)
  })

  it('should mask sensitive keys before comparing', () => {
    expect(diffAuditRecords({ password: 'old' }, { password: 'new' })).toEqual([])
  })

  it('should return nothing when both sides are absent', () => {
    expect(diffAuditRecords(null, null)).toEqual([])
  })
})

describe('summarizeAuditDiff', () => {
  it('should join up to three changes', () => {
    expect(summarizeAuditDiff({ a: 1, b: 1 }, { a: 2, b: 3 })).toBe('a: 1 → 2, b: 1 → 3')
  })

  it('should count the remainder past three changes', () => {
    const summary = summarizeAuditDiff({}, { a: 1, b: 2, c: 3, d: 4, e: 5 })

    expect(summary).toContain('외 2건')
  })

  it('should mark removed values', () => {
    expect(summarizeAuditDiff({ a: 1 }, {})).toBe('a: 1 → (없음)')
  })

  it('should render a dash when nothing changed', () => {
    expect(summarizeAuditDiff({ a: 1 }, { a: 1 })).toBe('-')
  })
})

describe('audit labels', () => {
  it('should translate known module actions into Korean verbs', () => {
    expect(auditActionLabel('gacha.create')).toBe('확률형 아이템 등록')
    expect(auditActionLabel('settings.update')).toBe('사이트 설정 수정')
    expect(auditActionLabel('banner.reorder')).toBe('히어로 배너 순서 변경')
  })

  it('should keep multi segment actions readable', () => {
    expect(auditActionLabel('rankings.snapshot.apply')).toBe('랭킹 스냅샷 적용')
  })

  it('should use the same verb across modules', () => {
    expect(auditActionLabel('news.delete')).toBe('뉴스 삭제')
    expect(auditActionLabel('comment.delete')).toBe('댓글 삭제')
  })

  it('should fall back to the raw action when the pair is unknown', () => {
    // 잘못 번역하는 것보다 원문을 보여 주는 편이 낫다.
    expect(auditActionLabel('mystery.blorp')).toBe('mystery.blorp')
  })

  it('should translate target tables', () => {
    expect(auditTableLabel('gacha_items')).toBe('확률형 아이템')
    expect(auditTableLabel(null)).toBe('-')
    expect(auditTableLabel('unknown_table')).toBe('unknown_table')
  })
})
