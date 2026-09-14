import { describe, expect, it } from 'vitest'

import {
  DEFAULT_INQUIRY_KIND,
  INQUIRY_KIND_MAP,
  INQUIRY_KIND_VALUES,
  INQUIRY_KINDS,
  inquiryKindLabel,
  isInquiryKind,
  type InquiryKind,
} from '@/lib/constants/inquiry-kind'

import * as clientInquiryKind from '../../../lib/constants/inquiry-kind'

/**
 * 관리자 쪽 접수 종류 상수의 가드.
 *
 * 사용자 사이트(`lib/constants/inquiry-kind.ts`)와 **두 벌**이다 — 별도 pnpm 패키지라
 * 서로를 import 하지 않는다. 어긋나면 사용자가 낸 "버그제보"가 관리자 목록에서 다른
 * 이름으로 보이고, 종류 필터(`?kind=`)가 빈 목록을 낸다. 그래서 값·라벨을 통째로 맞대 본다.
 */

/** 마이그레이션 20260914000100 의 CHECK 제약과 같은 목록·순서. */
const DB_KINDS: readonly InquiryKind[] = ['inquiry', 'bug', 'report']

describe('INQUIRY_KINDS', () => {
  it('should cover every kind the database accepts', () => {
    // Arrange & Act & Assert
    expect(INQUIRY_KIND_VALUES).toEqual(DB_KINDS)
  })

  it('should label each kind in Korean', () => {
    // Arrange & Act
    const labels = DB_KINDS.map((kind) => INQUIRY_KIND_MAP[kind].label)

    // Assert — 목록 뱃지·상세 메타·카테고리 섹션 제목이 모두 이 문구를 쓴다.
    expect(labels).toEqual(['1:1 문의', '버그제보', '불법이용제보'])
  })

  it('should key the map by the option value', () => {
    // Arrange & Act
    const mismatched = DB_KINDS.filter((kind) => INQUIRY_KIND_MAP[kind].value !== kind)

    // Assert
    expect(mismatched).toEqual([])
  })

  it('should default to the kind the database defaults to', () => {
    // Arrange & Act & Assert — `inquiry_categories.kind default 'inquiry'`.
    expect(DEFAULT_INQUIRY_KIND).toBe('inquiry')
  })
})

describe('client copy', () => {
  it('should carry the same values in the same order', () => {
    // Arrange & Act & Assert
    expect(clientInquiryKind.INQUIRY_KIND_VALUES).toEqual(INQUIRY_KIND_VALUES)
    expect(clientInquiryKind.DEFAULT_INQUIRY_KIND).toBe(DEFAULT_INQUIRY_KIND)
  })

  it('should carry the same labels, menu labels, paths and submit labels', () => {
    // Arrange & Act & Assert — 한 칸만 달라도 두 화면이 갈린다.
    expect(clientInquiryKind.INQUIRY_KINDS).toEqual(INQUIRY_KINDS)
  })
})

describe('isInquiryKind', () => {
  it('should accept every database value', () => {
    // Arrange & Act & Assert
    expect(DB_KINDS.every(isInquiryKind)).toBe(true)
  })

  it('should reject values that are not a kind', () => {
    // Arrange & Act & Assert — 종류 필터는 URL 에서 온다. 무엇이든 들어올 수 있다.
    expect(isInquiryKind('all')).toBe(false)
    expect(isInquiryKind('')).toBe(false)
    expect(isInquiryKind(null)).toBe(false)
    expect(isInquiryKind(undefined)).toBe(false)
  })
})

describe('inquiryKindLabel', () => {
  it('should label a known kind', () => {
    // Arrange & Act & Assert
    expect(inquiryKindLabel('report')).toBe('불법이용제보')
  })

  it('should fall back to the default label for an unknown value', () => {
    // Arrange & Act & Assert — DB 는 `kind: string` 으로 생성된다(CHECK 는 타입에 없다).
    expect(inquiryKindLabel('unknown')).toBe('1:1 문의')
  })
})
