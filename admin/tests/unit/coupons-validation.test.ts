import { describe, expect, it } from 'vitest'

import {
  AMBIGUOUS_CODE_CHARS,
  COUPON_CODE_ALPHABET,
  COUPON_DESCRIPTION_MAX_LENGTH,
  COUPON_NAME_MAX_LENGTH,
  COUPON_PER_USER_LIMIT_MAX,
  COUPON_REWARD_NOTE_MAX_LENGTH,
  couponSchema,
  deriveCouponStatus,
  generateCouponCode,
  hasAmbiguousCodeChars,
  isCouponCode,
  isoToKstLocal,
  kstLocalToIso,
  normalizeCouponCode,
  parseCouponFilters,
  sanitizeCouponSearch,
} from '@/lib/validation/coupons'

/**
 * 쿠폰 입력 계약.
 *
 * DB 쪽 규칙과 **같은 것**을 고정한다 — 정규화 식(`coupons.code_normalized`), 코드
 * 모양(`coupons_code_shape`), 상태 판정 순서(`redeem_coupon()`). 어느 한쪽만 바뀌면
 * 관리자가 만든 코드를 사용자가 넣었을 때 조용히 `invalid_code` 가 된다.
 */

const BASE = {
  code: 'GLZA-TEST-0001',
  name: '테스트 쿠폰',
  description: '',
  rewardNote: '',
  startsAt: '',
  endsAt: '',
  maxRedemptions: '',
  perUserLimit: '1',
  isActive: true,
}

describe('normalizeCouponCode', () => {
  it('should upper-case and drop every space', () => {
    expect(normalizeCouponCode('  glza-test-0001 ')).toBe('GLZA-TEST-0001')
    expect(normalizeCouponCode('glza test 0001')).toBe('GLZATEST0001')
  })

  it('should keep hyphens — dropping them would merge different codes', () => {
    expect(normalizeCouponCode('GLZA-TEST-0001')).not.toBe(normalizeCouponCode('GLZAT-EST0-001'))
  })

  it('should treat null and undefined as an empty code', () => {
    expect(normalizeCouponCode(null)).toBe('')
    expect(normalizeCouponCode(undefined)).toBe('')
  })
})

describe('isCouponCode', () => {
  it('should accept 4 to 32 characters of upper-case letters, digits and hyphens', () => {
    expect(isCouponCode('AB12')).toBe(true)
    expect(isCouponCode('A'.repeat(32))).toBe(true)
  })

  it('should reject values outside the DB constraint', () => {
    expect(isCouponCode('AB1')).toBe(false)
    expect(isCouponCode('A'.repeat(33))).toBe(false)
    expect(isCouponCode('glza-test')).toBe(false)
    expect(isCouponCode('-GLZA')).toBe(false)
    expect(isCouponCode('GLZA_TEST')).toBe(false)
  })
})

describe('generateCouponCode', () => {
  it('should build the GLZA-XXXX-XXXX shape', () => {
    expect(generateCouponCode(() => 0)).toMatch(/^GLZA-[A-Z0-9]{4}-[A-Z0-9]{4}$/)
    expect(isCouponCode(generateCouponCode(() => 0.5))).toBe(true)
  })

  it('should never emit an ambiguous character for any point of the alphabet', () => {
    // 알파벳의 모든 자리를 훑는다 — 확률이 아니라 경계로 고정한다.
    for (let index = 0; index < COUPON_CODE_ALPHABET.length; index += 1) {
      const code = generateCouponCode(() => index / COUPON_CODE_ALPHABET.length)

      expect(hasAmbiguousCodeChars(code)).toBe(false)
    }
  })

  it('should stay inside the alphabet when the supplier misbehaves', () => {
    expect(isCouponCode(generateCouponCode(() => 1))).toBe(true)
    expect(isCouponCode(generateCouponCode(() => -1))).toBe(true)
  })

  it('should exclude 0 · O · 1 · I from the alphabet itself', () => {
    for (const char of AMBIGUOUS_CODE_CHARS) {
      expect(COUPON_CODE_ALPHABET).not.toContain(char)
    }
  })
})

describe('hasAmbiguousCodeChars', () => {
  it('should flag hand-written codes that mix 0/O or 1/I', () => {
    expect(hasAmbiguousCodeChars('GLZA-TEST-0001')).toBe(true)
    expect(hasAmbiguousCodeChars('GLZA-WXYZ-2345')).toBe(false)
  })
})

describe('kstLocalToIso · isoToKstLocal', () => {
  it('should read datetime-local as Korean time', () => {
    expect(kstLocalToIso('2026-09-10T09:00')).toBe('2026-09-10T00:00:00.000Z')
  })

  it('should accept a seconds component as well', () => {
    expect(kstLocalToIso('2026-09-10T09:00:00')).toBe('2026-09-10T00:00:00.000Z')
  })

  it('should return null for empty or malformed values', () => {
    expect(kstLocalToIso('')).toBeNull()
    expect(kstLocalToIso('2026-09-10')).toBeNull()
    expect(kstLocalToIso(null)).toBeNull()
  })

  it('should round-trip back to the same Korean wall clock', () => {
    expect(isoToKstLocal(kstLocalToIso('2026-12-31T23:59'))).toBe('2026-12-31T23:59')
    expect(isoToKstLocal(null)).toBe('')
    expect(isoToKstLocal('not-a-date')).toBe('')
  })
})

describe('deriveCouponStatus', () => {
  const now = new Date('2026-09-10T00:00:00.000Z')

  it('should call a disabled coupon inactive whatever the window says', () => {
    expect(deriveCouponStatus({ isActive: false, startsAt: null, endsAt: null }, now)).toBe(
      'inactive',
    )
    expect(
      deriveCouponStatus(
        { isActive: false, startsAt: '2026-01-01T00:00:00Z', endsAt: '2027-01-01T00:00:00Z' },
        now,
      ),
    ).toBe('inactive')
  })

  it('should treat a coupon without a window as always active', () => {
    expect(deriveCouponStatus({ isActive: true, startsAt: null, endsAt: null }, now)).toBe('active')
  })

  it('should separate scheduled from expired', () => {
    expect(
      deriveCouponStatus({ isActive: true, startsAt: '2026-09-11T00:00:00Z', endsAt: null }, now),
    ).toBe('scheduled')
    expect(
      deriveCouponStatus({ isActive: true, startsAt: null, endsAt: '2026-09-09T00:00:00Z' }, now),
    ).toBe('expired')
  })

  it('should expire exactly at the end instant (end is exclusive)', () => {
    expect(
      deriveCouponStatus({ isActive: true, startsAt: null, endsAt: '2026-09-10T00:00:00Z' }, now),
    ).toBe('expired')
  })

  it('should include the start instant (start is inclusive)', () => {
    expect(
      deriveCouponStatus({ isActive: true, startsAt: '2026-09-10T00:00:00Z', endsAt: null }, now),
    ).toBe('active')
  })
})

describe('couponSchema — 코드 · 이름', () => {
  it('should normalize the code before saving', () => {
    const parsed = couponSchema.parse({ ...BASE, code: ' glza-test-0001 ' })

    expect(parsed.code).toBe('GLZA-TEST-0001')
  })

  it('should reject a code that breaks the DB constraint', () => {
    expect(couponSchema.safeParse({ ...BASE, code: 'AB1' }).success).toBe(false)
    expect(couponSchema.safeParse({ ...BASE, code: '' }).success).toBe(false)
    expect(couponSchema.safeParse({ ...BASE, code: 'GLZA_TEST' }).success).toBe(false)
  })

  it(`should cap the name at ${COUPON_NAME_MAX_LENGTH}`, () => {
    const limit = '가'.repeat(COUPON_NAME_MAX_LENGTH)

    expect(couponSchema.safeParse({ ...BASE, name: limit }).success).toBe(true)
    expect(couponSchema.safeParse({ ...BASE, name: `${limit}가` }).success).toBe(false)
    expect(couponSchema.safeParse({ ...BASE, name: '   ' }).success).toBe(false)
  })
})

describe('couponSchema — 선택 입력', () => {
  it('should turn blank optional text into null', () => {
    const parsed = couponSchema.parse({ ...BASE, description: '  ', rewardNote: '' })

    expect(parsed.description).toBeNull()
    expect(parsed.rewardNote).toBeNull()
  })

  it('should cap the description and the reward note', () => {
    const description = '가'.repeat(COUPON_DESCRIPTION_MAX_LENGTH + 1)
    const rewardNote = '가'.repeat(COUPON_REWARD_NOTE_MAX_LENGTH + 1)

    expect(couponSchema.safeParse({ ...BASE, description }).success).toBe(false)
    expect(couponSchema.safeParse({ ...BASE, rewardNote }).success).toBe(false)
  })
})

describe('couponSchema — 한도', () => {
  it('should read a blank global cap as unlimited', () => {
    expect(couponSchema.parse({ ...BASE, maxRedemptions: '' }).maxRedemptions).toBeNull()
    expect(couponSchema.parse({ ...BASE, maxRedemptions: '500' }).maxRedemptions).toBe(500)
  })

  it('should reject a non numeric or zero cap', () => {
    expect(couponSchema.safeParse({ ...BASE, maxRedemptions: '열' }).success).toBe(false)
    expect(couponSchema.safeParse({ ...BASE, maxRedemptions: '0' }).success).toBe(false)
    expect(couponSchema.safeParse({ ...BASE, maxRedemptions: '-3' }).success).toBe(false)
  })

  it(`should keep the per-user limit between 1 and ${COUPON_PER_USER_LIMIT_MAX}`, () => {
    expect(couponSchema.parse({ ...BASE, perUserLimit: '3' }).perUserLimit).toBe(3)
    expect(couponSchema.safeParse({ ...BASE, perUserLimit: '0' }).success).toBe(false)
    expect(
      couponSchema.safeParse({ ...BASE, perUserLimit: String(COUPON_PER_USER_LIMIT_MAX + 1) })
        .success,
    ).toBe(false)
    expect(couponSchema.safeParse({ ...BASE, perUserLimit: '' }).success).toBe(false)
  })
})

describe('couponSchema — 기간', () => {
  it('should store the window as UTC instants', () => {
    const parsed = couponSchema.parse({
      ...BASE,
      startsAt: '2026-09-10T09:00',
      endsAt: '2026-09-20T09:00',
    })

    expect(parsed.startsAt).toBe('2026-09-10T00:00:00.000Z')
    expect(parsed.endsAt).toBe('2026-09-20T00:00:00.000Z')
  })

  it('should allow an open window on either side', () => {
    expect(couponSchema.parse({ ...BASE, startsAt: '2026-09-10T09:00' }).endsAt).toBeNull()
    expect(couponSchema.parse({ ...BASE, endsAt: '2026-09-10T09:00' }).startsAt).toBeNull()
  })

  it('should refuse a window that ends before it starts', () => {
    const parsed = couponSchema.safeParse({
      ...BASE,
      startsAt: '2026-09-20T09:00',
      endsAt: '2026-09-10T09:00',
    })

    expect(parsed.success).toBe(false)
    expect(parsed.error?.issues[0]?.path).toEqual(['endsAt'])
  })

  it('should refuse a zero-length window', () => {
    expect(
      couponSchema.safeParse({
        ...BASE,
        startsAt: '2026-09-10T09:00',
        endsAt: '2026-09-10T09:00',
      }).success,
    ).toBe(false)
  })

  it('should refuse a malformed datetime', () => {
    expect(couponSchema.safeParse({ ...BASE, startsAt: '2026-09-10' }).success).toBe(false)
  })
})

describe('목록 필터', () => {
  it('should drop an unknown status instead of passing it to the query', () => {
    expect(parseCouponFilters({ status: 'burning' }).status).toBeNull()
    expect(parseCouponFilters({ status: 'expired' }).status).toBe('expired')
  })

  it('should strip PostgREST syntax from the search term', () => {
    expect(sanitizeCouponSearch('glza,(x)%_')).toBe('glza x')
    expect(sanitizeCouponSearch('   ')).toBeNull()
    expect(sanitizeCouponSearch(undefined)).toBeNull()
  })

  it('should cut the search term at the shared list limit', () => {
    expect(sanitizeCouponSearch('가'.repeat(100))).toHaveLength(60)
  })
})
