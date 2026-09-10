import { describe, expect, it } from 'vitest'

import { CONTACT_EMAIL, CONTACT_EMAIL_HREF } from '@/lib/constants/site'
import { toAsciiEmail, toDisplayEmail, toEmailLink } from '@/lib/utils/email'

// `care@gjstory.com`(현재 CONTACT_EMAIL)은 처음부터 ASCII 도메인이라 이 변환이
// no-op 이 된다. 그래도 관리자가 IDN 도메인을 입력하는 경우를 대비해 변환 로직
// 자체는 남아 있으므로, 아래 테스트는 CONTACT_EMAIL 과 무관한 일반 한글 도메인
// 예시(`테스트도메인.kr`)로 그 동작을 검증한다.
describe('toAsciiEmail', () => {
  it('should convert a Korean IDN domain to punycode when building a mailto address', () => {
    expect(toAsciiEmail('hello@테스트도메인.kr')).toBe('hello@xn--hq1bm8jmvhl7el8np6b.kr')
  })

  it('should keep an already-ASCII address unchanged', () => {
    expect(toAsciiEmail('hello@xn--hq1bm8jmvhl7el8np6b.kr')).toBe(
      'hello@xn--hq1bm8jmvhl7el8np6b.kr',
    )
    expect(toAsciiEmail('hello@example.com')).toBe('hello@example.com')
  })

  it('should be a no-op for the current CONTACT_EMAIL (ASCII domain)', () => {
    // gjstory.com 은 처음부터 ASCII 라 CONTACT_EMAIL_HREF 와 같은 값이 나온다.
    expect(toAsciiEmail(CONTACT_EMAIL)).toBe(CONTACT_EMAIL_HREF)
  })
})

describe('toDisplayEmail', () => {
  it('should convert punycode back to the Korean IDN for display', () => {
    expect(toDisplayEmail('hello@xn--hq1bm8jmvhl7el8np6b.kr')).toBe('hello@테스트도메인.kr')
  })

  it('should keep an already-ASCII form unchanged (current CONTACT_EMAIL)', () => {
    expect(toDisplayEmail(CONTACT_EMAIL)).toBe(CONTACT_EMAIL)
  })
})

describe('toEmailLink', () => {
  it('should produce the same pair regardless of which form was stored', () => {
    const fromUnicode = toEmailLink('hello@테스트도메인.kr')
    const fromAscii = toEmailLink('hello@xn--hq1bm8jmvhl7el8np6b.kr')

    expect(fromUnicode).toEqual(fromAscii)
    expect(fromUnicode).toEqual({
      display: 'hello@테스트도메인.kr',
      href: 'mailto:hello@xn--hq1bm8jmvhl7el8np6b.kr',
    })
  })

  it('should trim surrounding whitespace from the stored value', () => {
    expect(toEmailLink('  hello@테스트도메인.kr  ').display).toBe('hello@테스트도메인.kr')
  })

  it('should fall back to the raw value when the address is not parseable', () => {
    // 관리자 오타 하나로 푸터의 연락처가 통째로 사라지는 편이 더 나쁘다.
    expect(toEmailLink('연락처 문의')).toEqual({
      display: '연락처 문의',
      href: 'mailto:연락처 문의',
    })
    expect(toDisplayEmail('@테스트도메인.kr')).toBe('@테스트도메인.kr')
  })
})
