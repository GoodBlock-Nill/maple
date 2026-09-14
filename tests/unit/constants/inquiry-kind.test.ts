import { describe, expect, it } from 'vitest'

import {
  DEFAULT_INQUIRY_KIND,
  INQUIRY_KIND_MAP,
  INQUIRY_KIND_VALUES,
  INQUIRY_KINDS,
  inquiryKindLabel,
  isInquiryKind,
} from '@/lib/constants/inquiry-kind'

import * as adminInquiryKind from '../../../admin/lib/constants/inquiry-kind'

import type { InquiryKind } from '@/types/domain'

/**
 * 접수 종류 상수의 가드.
 *
 * 확인하는 것은 셋이다.
 *   1. DB CHECK 제약(`kind in ('inquiry','bug','report')`)과 값이 같다.
 *   2. 사용자 사이트와 관리자 콘솔의 상수가 어긋나지 않는다 — 두 패키지가 서로를
 *      import 하지 않아 복사본이 두 벌이고, 어긋나면 같은 문의가 두 이름으로 보인다.
 *   3. 경계 판정(`isInquiryKind`)이 DB·URL 에서 온 문자열을 제대로 좁힌다.
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

    // Assert
    expect(labels).toEqual(['1:1 문의', '버그제보', '불법이용제보'])
  })

  it('should key the map by the option value', () => {
    // Arrange & Act
    const mismatched = DB_KINDS.filter((kind) => INQUIRY_KIND_MAP[kind].value !== kind)

    // Assert — 키와 값이 어긋나면 뱃지가 다른 종류의 이름을 그린다.
    expect(mismatched).toEqual([])
  })

  it('should give every kind its own form route', () => {
    // Arrange & Act
    const paths = INQUIRY_KINDS.map((kind) => kind.path)

    // Assert
    expect(paths).toEqual(['/support', '/support/bug', '/support/report'])
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('should call submission 제보 for bug and report', () => {
    // Arrange & Act & Assert — 제보는 "문의하기"가 아니다.
    expect(INQUIRY_KIND_MAP.inquiry.submitLabel).toBe('문의하기')
    expect(INQUIRY_KIND_MAP.bug.submitLabel).toBe('제보하기')
    expect(INQUIRY_KIND_MAP.report.submitLabel).toBe('제보하기')
  })

  it('should default to the kind the database defaults to', () => {
    // Arrange & Act & Assert — `inquiries.kind default 'inquiry'`.
    expect(DEFAULT_INQUIRY_KIND).toBe('inquiry')
  })
})

describe('admin copy', () => {
  it('should carry the same values in the same order', () => {
    // Arrange & Act & Assert
    expect(adminInquiryKind.INQUIRY_KIND_VALUES).toEqual(INQUIRY_KIND_VALUES)
    expect(adminInquiryKind.DEFAULT_INQUIRY_KIND).toBe(DEFAULT_INQUIRY_KIND)
  })

  it('should carry the same labels, menu labels, paths and submit labels', () => {
    // Arrange & Act & Assert — 옵션 전체를 비교한다(한 칸만 달라도 화면이 갈린다).
    expect(adminInquiryKind.INQUIRY_KINDS).toEqual(INQUIRY_KINDS)
  })
})

describe('isInquiryKind', () => {
  it('should accept every database value', () => {
    // Arrange & Act & Assert
    expect(DB_KINDS.every(isInquiryKind)).toBe(true)
  })

  it('should reject values that are not a kind', () => {
    // Arrange & Act & Assert — URL(`?kind=`)로는 무엇이든 들어온다.
    expect(isInquiryKind('bugs')).toBe(false)
    expect(isInquiryKind('')).toBe(false)
    expect(isInquiryKind(null)).toBe(false)
    expect(isInquiryKind(undefined)).toBe(false)
    expect(isInquiryKind(0)).toBe(false)
  })
})

describe('inquiryKindLabel', () => {
  it('should label a known kind', () => {
    // Arrange & Act & Assert
    expect(inquiryKindLabel('bug')).toBe('버그제보')
  })

  it('should fall back to the default label for an unknown value', () => {
    // Arrange & Act & Assert — 화면이 빈칸을 그리는 것보다 낫다(CHECK 제약상 오지 않는 값이다).
    expect(inquiryKindLabel('unknown')).toBe('1:1 문의')
  })
})
