import { describe, expect, it } from 'vitest'

import { auditActionLabel } from '@/components/audit/audit-labels'
import {
  daysUntilPurge,
  lifecycleLabel,
  MEMBER_LIFECYCLE_LABEL,
  memberLifecycle,
  purgeCountdownLabel,
  purgeDueAt,
  purgedNickname,
  PURGE_RETENTION_DAYS,
} from '@/lib/validation/member-status'

/**
 * 탈퇴 · 파기 판정.
 *
 * D-day 계산과 우선순위가 화면마다 갈리면 "복구할 수 있는 회원"과 "이미 지워진
 * 회원"이 목록에서 섞인다. 되돌릴 수 없는 조작(즉시 파기)의 버튼이 그 판정 위에
 * 서 있으므로 규칙을 여기서 고정한다.
 */

/** 기준 시각을 고정한다. "지금"에 기대는 테스트는 자정 근처에서만 깨진다. */
const NOW = new Date('2026-09-09T12:00:00.000Z')
const DELETED = '2026-09-09T12:00:00.000Z'

describe('memberLifecycle', () => {
  it('should report an untouched profile as active', () => {
    expect(memberLifecycle({ deletedAt: null, purgedAt: null })).toBe('active')
  })

  it('should report a withdrawn profile while the retention window is open', () => {
    expect(memberLifecycle({ deletedAt: DELETED, purgedAt: null })).toBe('withdrawn')
  })

  it('should let purge win over withdrawal', () => {
    // 파기 배치는 deleted_at 을 비우지 않는다. 두 값이 함께 있는 것이 정상이다.
    expect(memberLifecycle({ deletedAt: DELETED, purgedAt: '2026-12-08T00:00:00.000Z' })).toBe(
      'purged',
    )
  })

  it('should report purge even when the withdrawal time is missing', () => {
    // 관리자가 손으로 넣은 데이터라도 "지워졌다"는 사실이 먼저다.
    expect(memberLifecycle({ deletedAt: null, purgedAt: '2026-12-08T00:00:00.000Z' })).toBe(
      'purged',
    )
  })
})

describe('purgeDueAt', () => {
  it('should add the retention period to the withdrawal time', () => {
    expect(PURGE_RETENTION_DAYS).toBe(90)
    expect(purgeDueAt(DELETED)).toBe('2026-12-08T12:00:00.000Z')
  })

  it('should return null when the member has not withdrawn', () => {
    expect(purgeDueAt(null)).toBeNull()
  })

  it('should return null for an unparsable timestamp instead of an invalid date', () => {
    expect(purgeDueAt('nope')).toBeNull()
  })
})

describe('daysUntilPurge', () => {
  it('should count the full retention period on the day of withdrawal', () => {
    expect(daysUntilPurge(DELETED, NOW)).toBe(90)
  })

  it('should round up so that a partial day still counts as a day left', () => {
    const almost = new Date('2026-12-08T00:00:00.000Z')

    expect(daysUntilPurge(DELETED, almost)).toBe(1)
  })

  it('should clamp to zero once the due time has passed', () => {
    // 배치가 아직 돌지 않은 구간. 음수가 화면에 D--3 으로 나오면 안 된다.
    const late = new Date('2026-12-11T12:00:00.000Z')

    expect(daysUntilPurge(DELETED, late)).toBe(0)
  })

  it('should return null when the member has not withdrawn', () => {
    expect(daysUntilPurge(null, NOW)).toBeNull()
    expect(purgeCountdownLabel(null, NOW)).toBeNull()
  })
})

describe('lifecycleLabel', () => {
  it('should attach the countdown only to the waiting state', () => {
    expect(lifecycleLabel({ deletedAt: null, purgedAt: null }, NOW)).toBe('정상')
    expect(lifecycleLabel({ deletedAt: DELETED, purgedAt: null }, NOW)).toBe('탈퇴 대기 D-90')
    expect(lifecycleLabel({ deletedAt: DELETED, purgedAt: DELETED }, NOW)).toBe('삭제됨')
  })

  it('should use the same words as the shared label table', () => {
    expect(MEMBER_LIFECYCLE_LABEL.withdrawn).toBe('탈퇴 대기')
    expect(MEMBER_LIFECYCLE_LABEL.purged).toBe('삭제됨')
  })
})

describe('purgedNickname', () => {
  it('should keep the short id so that purged members stay distinguishable', () => {
    expect(purgedNickname('11111111-1111-4111-8111-111111111111')).toBe('탈퇴한 회원#11111111')
  })
})

describe('auditActionLabel — 탈퇴 · 파기', () => {
  it('should spell out who acted for the self-service transitions', () => {
    expect(auditActionLabel('member.withdraw')).toBe('회원 탈퇴(본인)')
    expect(auditActionLabel('member.restore')).toBe('탈퇴 복구(본인)')
  })

  it('should label the administrator actions', () => {
    expect(auditActionLabel('member.purge')).toBe('개인정보 파기')
    expect(auditActionLabel('member.force_withdraw')).toBe('강제 탈퇴')
  })

  it('should keep the existing composed labels working', () => {
    expect(auditActionLabel('member.suspend')).toBe('회원 정지')
  })
})
