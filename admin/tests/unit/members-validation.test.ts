import { describe, expect, it } from 'vitest'

import {
  changeNicknameSchema,
  forceWithdrawMemberSchema,
  isPermanentSuspension,
  isSuspended,
  maskEmail,
  MEMBER_STATUS_FILTER_LABEL,
  MEMBER_STATUS_FILTERS,
  MEMBER_STATUS_LABEL,
  memberStatus,
  providerLabel,
  purgeMemberSchema,
  suspendMemberSchema,
  suspensionUntil,
  SUSPENSION_REASON_MAX,
} from '@/lib/validation/members'

/** 기준 시각을 고정한다. "지금"에 기대는 테스트는 자정 근처에서만 깨진다. */
const NOW = new Date('2026-09-08T12:00:00.000Z')

describe('suspensionUntil', () => {
  it('should add the selected number of days to the current time', () => {
    expect(suspensionUntil('1', NOW)).toBe('2026-09-09T12:00:00.000Z')
    expect(suspensionUntil('3', NOW)).toBe('2026-09-11T12:00:00.000Z')
    expect(suspensionUntil('7', NOW)).toBe('2026-09-15T12:00:00.000Z')
    expect(suspensionUntil('30', NOW)).toBe('2026-10-08T12:00:00.000Z')
  })

  it('should use the far-future sentinel for a permanent suspension', () => {
    const until = suspensionUntil('permanent', NOW)

    expect(isPermanentSuspension(until)).toBe(true)
    expect(isSuspended(until, NOW)).toBe(true)
  })
})

describe('isSuspended', () => {
  it('should return false when there is no end time', () => {
    expect(isSuspended(null, NOW)).toBe(false)
  })

  it('should return false when the end time has passed', () => {
    expect(isSuspended('2026-09-08T11:59:59.000Z', NOW)).toBe(false)
  })

  it('should return true while the end time is in the future', () => {
    expect(isSuspended('2026-09-08T12:00:01.000Z', NOW)).toBe(true)
  })
})

describe('memberStatus', () => {
  it('should report an administrator as admin even while suspended', () => {
    // 관리자 쓰기 정책에는 is_suspended() 검사가 없다 — 제재가 실효를 갖지 않는다.
    const status = memberStatus({ role: 'admin', suspendedUntil: '2026-12-31T00:00:00.000Z' }, NOW)

    expect(status).toBe('admin')
    expect(MEMBER_STATUS_LABEL[status]).toBe('관리자')
  })

  it('should report a suspended user', () => {
    expect(memberStatus({ role: 'user', suspendedUntil: '2026-09-09T00:00:00.000Z' }, NOW)).toBe(
      'suspended',
    )
  })

  it('should report a normal user when the suspension expired', () => {
    expect(memberStatus({ role: 'user', suspendedUntil: '2026-09-01T00:00:00.000Z' }, NOW)).toBe(
      'normal',
    )
  })
})

describe('maskEmail', () => {
  it('should keep the first two characters and the domain', () => {
    expect(maskEmail('adventurer@example.com')).toBe('ad********@example.com')
  })

  it('should keep only one character for a short local part', () => {
    expect(maskEmail('ab@example.com')).toBe('a*@example.com')
    expect(maskEmail('a@example.com')).toBe('a*@example.com')
  })

  it('should return a dash when there is no email', () => {
    expect(maskEmail(null)).toBe('-')
    expect(maskEmail('   ')).toBe('-')
  })

  it('should hide the whole value when it is not an email', () => {
    expect(maskEmail('not-an-email')).toBe('************')
  })
})

describe('providerLabel', () => {
  it('should translate known providers and fall back to 이메일 for empty values', () => {
    expect(providerLabel('kakao')).toBe('카카오')
    expect(providerLabel('google')).toBe('구글')
    expect(providerLabel(null)).toBe('이메일')
  })

  it('should show unknown providers as-is instead of hiding them', () => {
    expect(providerLabel('apple')).toBe('apple')
  })
})

const MEMBER_ID = '11111111-1111-4111-8111-111111111111'

describe('suspendMemberSchema', () => {
  it('should accept a preset period with a reason', () => {
    const parsed = suspendMemberSchema.safeParse({
      memberId: MEMBER_ID,
      period: '3',
      reason: '  욕설 반복  ',
    })

    expect(parsed.success).toBe(true)
    expect(parsed.data?.reason).toBe('욕설 반복')
  })

  it('should reject an unknown period', () => {
    const parsed = suspendMemberSchema.safeParse({
      memberId: MEMBER_ID,
      period: '2',
      reason: '사유',
    })

    expect(parsed.success).toBe(false)
  })

  it('should reject an empty reason', () => {
    const parsed = suspendMemberSchema.safeParse({
      memberId: MEMBER_ID,
      period: '1',
      reason: '   ',
    })

    expect(parsed.success).toBe(false)
  })

  it('should reject a reason longer than the limit', () => {
    const parsed = suspendMemberSchema.safeParse({
      memberId: MEMBER_ID,
      period: '1',
      reason: 'ㄱ'.repeat(SUSPENSION_REASON_MAX + 1),
    })

    expect(parsed.success).toBe(false)
  })

  it('should reject a target that is not a uuid', () => {
    expect(
      suspendMemberSchema.safeParse({ memberId: 'nope', period: '1', reason: '사유' }).success,
    ).toBe(false)
  })
})

describe('changeNicknameSchema', () => {
  it('should accept hangul, latin, digits and underscore', () => {
    expect(
      changeNicknameSchema.safeParse({ memberId: MEMBER_ID, nickname: '모험가_01', reason: '신고' })
        .success,
    ).toBe(true)
  })

  it('should reject a nickname with spaces or symbols', () => {
    expect(
      changeNicknameSchema.safeParse({ memberId: MEMBER_ID, nickname: '모험 가', reason: '신고' })
        .success,
    ).toBe(false)
    expect(
      changeNicknameSchema.safeParse({ memberId: MEMBER_ID, nickname: 'a@b', reason: '신고' })
        .success,
    ).toBe(false)
  })

  it('should enforce the length range shared with the user site', () => {
    expect(
      changeNicknameSchema.safeParse({ memberId: MEMBER_ID, nickname: 'ㄱ', reason: '신고' })
        .success,
    ).toBe(false)
    expect(
      changeNicknameSchema.safeParse({
        memberId: MEMBER_ID,
        nickname: '가'.repeat(13),
        reason: '신고',
      }).success,
    ).toBe(false)
  })

  it('should require a reason', () => {
    expect(
      changeNicknameSchema.safeParse({ memberId: MEMBER_ID, nickname: '모험가', reason: '' })
        .success,
    ).toBe(false)
  })
})

describe('MEMBER_STATUS_FILTERS', () => {
  it('should keep the existing filters and add the withdrawal states', () => {
    expect([...MEMBER_STATUS_FILTERS]).toEqual([
      'normal',
      'suspended',
      'withdrawn',
      'purged',
      'admin',
    ])
  })

  it('should label every filter value', () => {
    for (const value of MEMBER_STATUS_FILTERS) {
      expect(MEMBER_STATUS_FILTER_LABEL[value]).toBeTruthy()
    }
  })
})

describe('생애주기 액션 스키마', () => {
  it('should accept a uuid target', () => {
    expect(purgeMemberSchema.safeParse({ memberId: MEMBER_ID }).success).toBe(true)
    expect(forceWithdrawMemberSchema.safeParse({ memberId: MEMBER_ID }).success).toBe(true)
  })

  it('should reject anything that is not a uuid', () => {
    // 직접 POST 로 임의 문자열이 들어와도 조회 단계까지 가지 못해야 한다.
    expect(purgeMemberSchema.safeParse({ memberId: 'all' }).success).toBe(false)
    expect(forceWithdrawMemberSchema.safeParse({ memberId: '' }).success).toBe(false)
  })
})
