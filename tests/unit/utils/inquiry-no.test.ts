import { describe, expect, it } from 'vitest'

import { formatInquiryNo, formatInquiryNoLabel } from '@/lib/utils/inquiry-no'

/**
 * 접수번호 표기.
 *
 * 사용자 화면·관리자 콘솔·답변 메일이 **같은 문자열**을 써야 한다. 한쪽이 `1024`,
 * 다른 쪽이 `#1024` 로 적으면 "검색창에 뭘 넣어야 하느냐"부터 갈린다. 관리자 쪽에도
 * 같은 내용의 파일이 있고(`admin/lib/utils/inquiry-no.ts`), 그쪽 테스트가 같은
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
 * 목록·상세의 `No.` 표기(시안 v2).
 *
 * `#1024`(접수 완료 모달·관리자)와 **같은 숫자**를 가리킨다는 것이 눈에 보여야
 * 한다. 그래서 접두사만 다르고 숫자는 손대지 않는다.
 */
describe('formatInquiryNoLabel', () => {
  it('should read as No. followed by the plain number', () => {
    // Arrange & Act & Assert
    expect(formatInquiryNoLabel(1024)).toBe('No. 1024')
    expect(formatInquiryNoLabel(12345)).toBe('No. 12345')
  })

  it('should point at the same number as the hash form', () => {
    // Arrange & Act & Assert — 두 표기가 갈리면 고객센터 통화에서 번호가 어긋난다.
    expect(formatInquiryNoLabel(1024).endsWith(formatInquiryNo(1024).slice(1))).toBe(true)
  })

  it('should fall back to a bare dash when the number is missing', () => {
    // Arrange & Act & Assert — "No. -" 는 번호가 있는 것처럼 읽힌다.
    expect(formatInquiryNoLabel(null)).toBe('-')
    expect(formatInquiryNoLabel(undefined)).toBe('-')
    expect(formatInquiryNoLabel(Number.NaN)).toBe('-')
  })
})
