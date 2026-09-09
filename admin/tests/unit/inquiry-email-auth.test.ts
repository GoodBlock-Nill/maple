import { describe, expect, it } from 'vitest'

import { hasEmailAuthFailure, parseEmailAuth } from '@/lib/data/inquiry-email'

/**
 * 인증 판정(SPF · DKIM · DMARC)은 수신 제공자가 준 jsonb 를 그대로 담아 둔 것이라
 * 모양을 보장할 수 없다. 깨진 값 하나로 문의 상세가 열리지 않으면 안 되므로,
 * 화면에 닿기 전에 여기서 전부 좁힌다.
 */
describe('parseEmailAuth', () => {
  it('should read the three verdicts when the shape is as expected', () => {
    const value = { spf: 'pass', dkim: 'fail', dmarc: 'none' }

    expect(parseEmailAuth(value)).toEqual({ spf: 'pass', dkim: 'fail', dmarc: 'none' })
  })

  it('should lowercase and trim so provider spelling does not matter', () => {
    expect(parseEmailAuth({ spf: ' PASS ', dkim: 'Fail', dmarc: 'None' })).toEqual({
      spf: 'pass',
      dkim: 'fail',
      dmarc: 'none',
    })
  })

  it('should fill missing or non-string keys with null', () => {
    expect(parseEmailAuth({ spf: 'pass' })).toEqual({ spf: 'pass', dkim: null, dmarc: null })
    expect(parseEmailAuth({ spf: 1, dkim: '', dmarc: null })).toEqual({
      spf: null,
      dkim: null,
      dmarc: null,
    })
  })

  it('should return null when the value is not a plain object', () => {
    expect(parseEmailAuth(null)).toBeNull()
    expect(parseEmailAuth(undefined)).toBeNull()
    expect(parseEmailAuth('pass')).toBeNull()
    expect(parseEmailAuth(['pass'])).toBeNull()
    expect(parseEmailAuth(42)).toBeNull()
  })
})

describe('hasEmailAuthFailure', () => {
  it('should flag the row when any verdict failed', () => {
    expect(hasEmailAuthFailure({ spf: 'fail', dkim: 'pass', dmarc: 'pass' })).toBe(true)
    expect(hasEmailAuthFailure({ spf: 'pass', dkim: 'FAIL', dmarc: 'pass' })).toBe(true)
    expect(hasEmailAuthFailure({ dmarc: 'fail' })).toBe(true)
  })

  /* 'none' 은 도메인이 레코드를 두지 않은 정상적인 상태다. 여기까지 경고로 칠하면
     '인증 실패' 뱃지가 모든 행에 붙어 곧 의미를 잃는다. */
  it('should not flag a row that merely has no verdict', () => {
    expect(hasEmailAuthFailure({ spf: 'pass', dkim: 'none', dmarc: null })).toBe(false)
    expect(hasEmailAuthFailure({})).toBe(false)
    expect(hasEmailAuthFailure(null)).toBe(false)
    expect(hasEmailAuthFailure('fail')).toBe(false)
  })
})
