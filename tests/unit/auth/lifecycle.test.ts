import { describe, expect, it } from 'vitest'

import {
  canRestoreProfile,
  daysSinceWithdrawal,
  isPurgedProfile,
  isWithdrawnProfile,
  resolvePostAuthDestination,
  restoreNotice,
  WITHDRAWN_NOTICE_MESSAGE,
} from '@/lib/auth/lifecycle'

const NOW = new Date('2026-09-09T12:00:00.000Z').getTime()

const ACTIVE = {
  nickname: '모험가',
  terms_agreed_at: '2026-09-01T00:00:00.000Z',
  privacy_agreed_at: '2026-09-01T00:00:00.000Z',
  age_confirmed_at: '2026-09-01T00:00:00.000Z',
  deleted_at: null,
  purged_at: null,
}
const WITHDRAWN = { ...ACTIVE, deleted_at: '2026-09-01T12:00:00.000Z' }
const PURGED = { ...WITHDRAWN, purged_at: '2026-09-09T00:00:00.000Z' }

describe('isWithdrawnProfile / isPurgedProfile / canRestoreProfile', () => {
  it('should treat a profile without deleted_at as an active member', () => {
    expect(isWithdrawnProfile(ACTIVE)).toBe(false)
    expect(canRestoreProfile(ACTIVE)).toBe(false)
  })

  it('should treat a missing profile as active so a trigger failure does not lock everyone out', () => {
    expect(isWithdrawnProfile(null)).toBe(false)
    expect(isWithdrawnProfile(undefined)).toBe(false)
  })

  it('should allow restoring while withdrawn and not yet purged', () => {
    expect(isWithdrawnProfile(WITHDRAWN)).toBe(true)
    expect(isPurgedProfile(WITHDRAWN)).toBe(false)
    expect(canRestoreProfile(WITHDRAWN)).toBe(true)
  })

  it('should refuse restoring once the profile is purged', () => {
    expect(isWithdrawnProfile(PURGED)).toBe(true)
    expect(isPurgedProfile(PURGED)).toBe(true)
    expect(canRestoreProfile(PURGED)).toBe(false)
  })
})

describe('daysSinceWithdrawal', () => {
  it('should floor to whole days', () => {
    expect(daysSinceWithdrawal('2026-09-01T12:00:00.000Z', NOW)).toBe(8)
    expect(daysSinceWithdrawal('2026-09-09T11:00:00.000Z', NOW)).toBe(0)
  })

  it('should return 0 for empty or invalid values', () => {
    expect(daysSinceWithdrawal(null, NOW)).toBe(0)
    expect(daysSinceWithdrawal('not-a-date', NOW)).toBe(0)
  })

  it('should never go negative when the clock is behind the stamp', () => {
    expect(daysSinceWithdrawal('2026-09-10T00:00:00.000Z', NOW)).toBe(0)
  })
})

describe('restoreNotice', () => {
  it('should state the elapsed days and that suspensions stay in place', () => {
    expect(restoreNotice('2026-09-01T12:00:00.000Z', NOW)).toBe(
      '탈퇴 후 8일이 지났습니다. 계속하면 계정이 복구됩니다. 이용 제한이 있었다면 그대로 적용됩니다.',
    )
  })
})

describe('resolvePostAuthDestination', () => {
  it('should send a withdrawn member to the restore screen before anything else', () => {
    expect(resolvePostAuthDestination(WITHDRAWN, '/community')).toBe(
      `/auth/restore?next=${encodeURIComponent('/community')}`,
    )
  })

  it('should send a withdrawn member to restore even when onboarding is incomplete', () => {
    expect(resolvePostAuthDestination({ ...WITHDRAWN, nickname: null }, '/')).toBe(
      `/auth/restore?next=${encodeURIComponent('/')}`,
    )
  })

  it('should send a purged-but-still-signed-in account to the restore screen (which explains why)', () => {
    expect(resolvePostAuthDestination(PURGED, '/')).toBe(
      `/auth/restore?next=${encodeURIComponent('/')}`,
    )
  })

  it('should send an active member without onboarding to onboarding', () => {
    expect(resolvePostAuthDestination({ ...ACTIVE, terms_agreed_at: null }, '/account')).toBe(
      `/auth/onboarding?next=${encodeURIComponent('/account')}`,
    )
  })

  it('should send a fully onboarded active member to the sanitized destination', () => {
    expect(resolvePostAuthDestination(ACTIVE, '/community/write')).toBe('/community/write')
    expect(resolvePostAuthDestination(ACTIVE, 'https://evil.example')).toBe('/')
  })

  it('should never loop back into the restore or onboarding screens', () => {
    expect(resolvePostAuthDestination(ACTIVE, '/auth/restore?next=%2F')).toBe('/')
    expect(resolvePostAuthDestination(WITHDRAWN, '/auth/restore')).toBe(
      `/auth/restore?next=${encodeURIComponent('/')}`,
    )
  })
})

describe('WITHDRAWN_NOTICE_MESSAGE', () => {
  it('should match the approved one-time notice text', () => {
    expect(WITHDRAWN_NOTICE_MESSAGE).toBe(
      '탈퇴가 접수되었습니다. 90일 안에 다시 로그인하면 계정이 복구됩니다.',
    )
  })
})
