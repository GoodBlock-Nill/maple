import { describe, expect, it } from 'vitest'

import { CONTACT_EMAIL, CONTACT_EMAIL_HREF } from '@/lib/constants/site'
import { toAsciiEmail, toDisplayEmail, toEmailLink } from '@/lib/utils/email'

describe('toAsciiEmail', () => {
  it('should convert a Korean IDN domain to punycode when building a mailto address', () => {
    expect(toAsciiEmail('contact@글자월드.co.kr')).toBe('contact@xn--bj0b33kj0qqva.co.kr')
  })

  it('should keep an already-ASCII address unchanged', () => {
    expect(toAsciiEmail('contact@xn--bj0b33kj0qqva.co.kr')).toBe('contact@xn--bj0b33kj0qqva.co.kr')
    expect(toAsciiEmail('hello@example.com')).toBe('hello@example.com')
  })

  it('should reproduce the documented CONTACT_EMAIL_HREF invariant', () => {
    // 상수를 지우지 않은 이유가 이 한 줄이다 — 변환 결과가 기존 링크와 같아야 한다.
    expect(toAsciiEmail(CONTACT_EMAIL)).toBe(CONTACT_EMAIL_HREF)
  })
})

describe('toDisplayEmail', () => {
  it('should convert punycode back to the Korean IDN for display', () => {
    expect(toDisplayEmail('contact@xn--bj0b33kj0qqva.co.kr')).toBe('contact@글자월드.co.kr')
  })

  it('should keep the Korean form unchanged', () => {
    expect(toDisplayEmail(CONTACT_EMAIL)).toBe(CONTACT_EMAIL)
  })
})

describe('toEmailLink', () => {
  it('should produce the same pair regardless of which form was stored', () => {
    const fromUnicode = toEmailLink('contact@글자월드.co.kr')
    const fromAscii = toEmailLink('contact@xn--bj0b33kj0qqva.co.kr')

    expect(fromUnicode).toEqual(fromAscii)
    expect(fromUnicode).toEqual({
      display: 'contact@글자월드.co.kr',
      href: 'mailto:contact@xn--bj0b33kj0qqva.co.kr',
    })
  })

  it('should trim surrounding whitespace from the stored value', () => {
    expect(toEmailLink('  contact@글자월드.co.kr  ').display).toBe('contact@글자월드.co.kr')
  })

  it('should fall back to the raw value when the address is not parseable', () => {
    // 관리자 오타 하나로 푸터의 연락처가 통째로 사라지는 편이 더 나쁘다.
    expect(toEmailLink('연락처 문의')).toEqual({
      display: '연락처 문의',
      href: 'mailto:연락처 문의',
    })
    expect(toDisplayEmail('@글자월드.co.kr')).toBe('@글자월드.co.kr')
  })
})
