import { describe, expect, it } from 'vitest'

import { formatInquiryNo } from '@/lib/utils/inquiry-no'
import { parseInquiryNoSearch } from '@/lib/validation/inquiry-no-search'

/**
 * 접수번호 표기.
 *
 * 사용자 화면·관리자 콘솔·답변 메일이 **같은 문자열**을 써야 한다. 한쪽이 `1024`,
 * 다른 쪽이 `#1024` 로 적으면 "검색창에 뭘 넣어야 하느냐"부터 갈린다. 사용자 사이트에도
 * 같은 내용의 파일이 있고(`lib/utils/inquiry-no.ts`), 그쪽 테스트가 같은
 * 기대값을 고정한다.
 */
describe('formatInquiryNo', () => {
  it('should prefix a hash so the number reads as a receipt number', () => {
    // Arrange & Act & Assert
    expect(formatInquiryNo(1024)).toBe('#1024')
    expect(formatInquiryNo(1001)).toBe('#1001')
  })

  it('should not group digits', () => {
    /* Arrange & Act & Assert — `#12,345` 를 받아 적은 사용자는 검색창에 쉼표까지 넣는다. */
    expect(formatInquiryNo(12345)).toBe('#12345')
  })

  it('should fall back to a dash when the number is missing', () => {
    // Arrange & Act & Assert — 열을 고르지 않은 화면에서 '#undefined' 가 새어 나가지 않게 한다.
    expect(formatInquiryNo(null)).toBe('-')
    expect(formatInquiryNo(undefined)).toBe('-')
    expect(formatInquiryNo(Number.NaN)).toBe('-')
  })
})

/**
 * 검색어에서 접수번호 읽기.
 *
 * 운영자는 사용자가 불러 준 값을 그대로 붙여 넣는다 — `#1024` 든 `1024` 든 같은
 * 문의가 나와야 한다. 번호가 아닌 검색어는 기존 제목·본문 검색만 타야 하므로
 * null 로 떨어뜨린다.
 */
describe('parseInquiryNoSearch', () => {
  it('should read both the bare number and the hashed form', () => {
    // Arrange & Act & Assert
    expect(parseInquiryNoSearch('1024')).toBe(1024)
    expect(parseInquiryNoSearch('#1024')).toBe(1024)
    expect(parseInquiryNoSearch('  #1024  ')).toBe(1024)
  })

  it('should ignore searches that are not a number', () => {
    // Arrange & Act & Assert — 제목 검색까지 번호 조건으로 바꾸면 결과가 사라진다.
    expect(parseInquiryNoSearch('결제 오류')).toBeNull()
    expect(parseInquiryNoSearch('#abc')).toBeNull()
    expect(parseInquiryNoSearch('10 24')).toBeNull()
    expect(parseInquiryNoSearch(undefined)).toBeNull()
  })

  it('should refuse 0 and absurdly long digits', () => {
    // Arrange & Act & Assert — bigint 를 넘는 값은 질의 자체가 실패한다.
    expect(parseInquiryNoSearch('0')).toBeNull()
    expect(parseInquiryNoSearch('9'.repeat(20))).toBeNull()
  })

  it('should take the first value when the key repeats', () => {
    // Arrange & Act & Assert — `?q=1024&q=1025` 같은 주소도 화면을 깨지 않아야 한다.
    expect(parseInquiryNoSearch(['1024', '1025'])).toBe(1024)
  })
})
