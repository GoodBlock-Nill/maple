import { describe, expect, it } from 'vitest'

import {
  couponLabel,
  COUPON_ERROR_FIELD,
  COUPON_GENERIC_FAILURE_MESSAGE,
  couponErrorMessage,
  maskCouponCode,
  parseRedeemCouponResult,
  toCouponStatus,
} from '@/lib/utils/coupon-result'

/**
 * `redeem_coupon()` 결과 → 화면 문구.
 *
 * RPC 는 예외를 던지지 않고 jsonb 로만 답한다. 이 매핑이 사용자에게 보이는 유일한
 * 설명이므로, 모르는 모양이 성공으로 읽히지 않는지를 특히 본다.
 */

describe('parseRedeemCouponResult', () => {
  it('should read a success payload', () => {
    // Arrange & Act
    const result = parseRedeemCouponResult({
      ok: true,
      redemption_id: 'c09f31cd-c7f8-49b5-b7e6-94b8762f752c',
      coupon_name: '클라이언트 연동 테스트 쿠폰',
      reward_note: '테스트 보상',
    })

    // Assert
    expect(result).toEqual({
      ok: true,
      redemptionId: 'c09f31cd-c7f8-49b5-b7e6-94b8762f752c',
      couponName: '클라이언트 연동 테스트 쿠폰',
      rewardNote: '테스트 보상',
    })
  })

  it('should read a failure code', () => {
    // Arrange & Act
    const result = parseRedeemCouponResult({ ok: false, code: 'already_redeemed' })

    // Assert
    expect(result).toEqual({ ok: false, code: 'already_redeemed' })
  })

  it('should treat an unknown shape as a failure', () => {
    // Arrange & Act — 성공으로 오해하면 지급되지 않은 쿠폰을 "등록됨"으로 알린다.
    expect(parseRedeemCouponResult(null)).toEqual({ ok: false, code: 'unknown' })
    expect(parseRedeemCouponResult('ok')).toEqual({ ok: false, code: 'unknown' })
    expect(parseRedeemCouponResult([{ ok: true }])).toEqual({ ok: false, code: 'unknown' })
  })

  it('should fall back to a neutral coupon name when the RPC omits it', () => {
    // Arrange & Act
    const result = parseRedeemCouponResult({ ok: true })

    // Assert
    expect(result.ok === true && result.couponName).toBe('쿠폰')
  })
})

describe('couponErrorMessage', () => {
  it.each([
    ['invalid_code', '존재하지 않거나 사용할 수 없는 쿠폰 코드입니다.'],
    ['not_started', '아직 사용 기간이 시작되지 않은 쿠폰입니다.'],
    ['expired', '사용 기간이 지난 쿠폰입니다.'],
    ['limit_reached', '쿠폰 수량이 모두 소진되었습니다.'],
    ['already_redeemed', '이미 등록한 쿠폰입니다.'],
    ['msw_uid_taken', '이미 다른 계정에 연결된 월드 계정 UID입니다. 고객지원에 문의해 주세요.'],
  ])('should translate %s', (code, message) => {
    // Arrange & Act & Assert
    expect(couponErrorMessage(code)).toBe(message)
  })

  it('should fall back for a code it does not know', () => {
    // Arrange & Act & Assert — DB 가 코드를 늘려도 영문 원문이 새어 나가지 않는다.
    expect(couponErrorMessage('brand_new_code')).toBe(COUPON_GENERIC_FAILURE_MESSAGE)
  })
})

describe('COUPON_ERROR_FIELD', () => {
  it('should send code problems to the code field and account problems to their own', () => {
    // Arrange & Act & Assert
    expect(COUPON_ERROR_FIELD.invalid_code).toBe('code')
    expect(COUPON_ERROR_FIELD.msw_uid_taken).toBe('mswUid')
    expect(COUPON_ERROR_FIELD.invalid_msw_profile_code).toBe('mswProfileCode')
  })

  it('should leave account-wide failures to the form-level notice', () => {
    // Arrange & Act & Assert
    expect(COUPON_ERROR_FIELD.suspended).toBeUndefined()
    expect(COUPON_ERROR_FIELD.withdrawn).toBeUndefined()
  })
})

describe('toCouponStatus', () => {
  it('should keep known statuses and default the rest to pending', () => {
    // Arrange & Act & Assert
    expect(toCouponStatus('delivered')).toBe('delivered')
    expect(toCouponStatus('rejected')).toBe('rejected')
    expect(toCouponStatus('anything-else')).toBe('pending')
  })
})

describe('couponLabel', () => {
  it('should prefer the name, then the masked code, then a neutral word', () => {
    // Arrange & Act & Assert
    expect(couponLabel('테스트 쿠폰', 'GLZA-TEST-0001')).toBe('테스트 쿠폰')
    expect(couponLabel(null, 'GLZA-TEST-0001')).toBe('****-0001')
    expect(couponLabel('  ', null)).toBe('쿠폰')
  })
})

describe('maskCouponCode', () => {
  it('should keep only the last four characters', () => {
    // Arrange & Act & Assert
    expect(maskCouponCode('GLZA-TEST-0001')).toBe('****-0001')
  })

  it('should render a dash when the code is not readable', () => {
    // Arrange & Act & Assert — coupons 에는 사용자 select 정책이 없다.
    expect(maskCouponCode(null)).toBe('-')
  })
})
