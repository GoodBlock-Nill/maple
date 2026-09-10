import { describe, expect, it } from 'vitest'

import {
  COUPON_ADMIN_NOTE_MAX_LENGTH,
  COUPON_REDEMPTION_STATUSES,
  canTransitionRedemptionStatus,
  couponRedemptionStatusSchema,
  isCouponRedemptionStatus,
  parseRedemptionFilters,
} from '@/lib/validation/coupon-redemptions'

/**
 * 등록 내역의 상태 전이 규약.
 *
 * 화면(버튼)과 서버 액션이 **같은 표**를 봐야 "화면에는 없는데 직접 POST 하면
 * 통과하는" 구멍이 생기지 않는다. 여기서 그 표를 고정한다.
 */

const REDEMPTION_ID = '44444444-4444-4444-8444-444444444444'

describe('상태 전이', () => {
  it('should only move a pending redemption forward', () => {
    expect(canTransitionRedemptionStatus('pending', 'delivered')).toBe(true)
    expect(canTransitionRedemptionStatus('pending', 'rejected')).toBe(true)
  })

  it('should never reopen a finished redemption', () => {
    for (const from of ['delivered', 'rejected'] as const) {
      for (const to of COUPON_REDEMPTION_STATUSES) {
        expect(canTransitionRedemptionStatus(from, to)).toBe(false)
      }
    }
  })

  it('should not treat a no-op as a transition', () => {
    expect(canTransitionRedemptionStatus('pending', 'pending')).toBe(false)
  })

  it('should narrow only known statuses', () => {
    expect(isCouponRedemptionStatus('delivered')).toBe(true)
    expect(isCouponRedemptionStatus('paid')).toBe(false)
    expect(isCouponRedemptionStatus(null)).toBe(false)
  })
})

describe('couponRedemptionStatusSchema', () => {
  const base = { redemptionId: REDEMPTION_ID, status: 'delivered', note: '' }

  it('should accept the two actionable statuses only', () => {
    expect(couponRedemptionStatusSchema.safeParse(base).success).toBe(true)
    expect(couponRedemptionStatusSchema.safeParse({ ...base, status: 'rejected' }).success).toBe(
      true,
    )
    // 'pending' 으로 되돌리는 요청은 스키마에서 이미 막힌다.
    expect(couponRedemptionStatusSchema.safeParse({ ...base, status: 'pending' }).success).toBe(
      false,
    )
  })

  it('should turn a blank note into null', () => {
    expect(couponRedemptionStatusSchema.parse({ ...base, note: '   ' }).note).toBeNull()
  })

  it('should normalize CRLF before measuring the note', () => {
    const parsed = couponRedemptionStatusSchema.parse({ ...base, note: '첫 줄\r\n둘째 줄' })

    expect(parsed.note).toBe('첫 줄\n둘째 줄')
  })

  it(`should cap the note at ${COUPON_ADMIN_NOTE_MAX_LENGTH}`, () => {
    const limit = '가'.repeat(COUPON_ADMIN_NOTE_MAX_LENGTH)

    expect(couponRedemptionStatusSchema.safeParse({ ...base, note: limit }).success).toBe(true)
    expect(couponRedemptionStatusSchema.safeParse({ ...base, note: `${limit}가` }).success).toBe(
      false,
    )
  })

  it('should reject a non uuid target', () => {
    expect(couponRedemptionStatusSchema.safeParse({ ...base, redemptionId: 'nope' }).success).toBe(
      false,
    )
  })
})

describe('parseRedemptionFilters', () => {
  it('should read the rstatus key so it does not clash with the coupon status', () => {
    expect(parseRedemptionFilters({ rstatus: 'pending' }).status).toBe('pending')
    expect(parseRedemptionFilters({ status: 'pending' }).status).toBeNull()
  })

  it('should drop an unknown status', () => {
    expect(parseRedemptionFilters({ rstatus: 'paid' }).status).toBeNull()
    expect(parseRedemptionFilters({}).status).toBeNull()
  })
})
