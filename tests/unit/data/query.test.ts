import { describe, expect, it } from 'vitest'

import {
  accumulatedRange,
  containsPattern,
  escapeLikePattern,
  pageRange,
  toListResult,
  toPagedListResult,
} from '@/lib/data/query'

/**
 * 번호 페이지네이션(내 문의 내역)의 경계.
 *
 * 누적 목록과 달리 앞 페이지를 다시 읽지 않는다 — 한 장만 그리는 화면에서
 * 0번 행부터 읽으면 페이지를 넘길수록 응답이 무거워진다.
 */
describe('pageRange', () => {
  it('should request only the first page when page is one', () => {
    // Arrange & Act & Assert — range() 는 양끝 포함이라 0..5 가 6건이다.
    expect(pageRange(1, 6)).toEqual({ from: 0, to: 5 })
  })

  it('should skip the previous pages when page is greater than one', () => {
    // Arrange & Act & Assert
    expect(pageRange(3, 6)).toEqual({ from: 12, to: 17 })
  })

  it('should fall back to the first page for zero, negative and fractional pages', () => {
    // Arrange & Act & Assert — 주소창의 잘못된 값도 404 대신 첫 페이지다.
    expect(pageRange(0, 6)).toEqual({ from: 0, to: 5 })
    expect(pageRange(-2, 6)).toEqual({ from: 0, to: 5 })
    expect(pageRange(2.9, 6)).toEqual({ from: 6, to: 11 })
  })
})

describe('toPagedListResult', () => {
  const items = Array.from({ length: 6 }, (_, index) => index)

  it('should report the rows of this page only', () => {
    // Arrange & Act
    const result = toPagedListResult(items, 25, 2, 6)

    // Assert — shown 은 누적이 아니라 이 페이지에 그린 건수다.
    expect(result).toEqual({ items, total: 25, shown: 6, page: 2, hasMore: true })
  })

  it('should judge the last page by the page boundary, not by the row count', () => {
    // Arrange & Act — 마지막 페이지가 덜 차도 "더 있다"로 남으면 안 된다.
    const result = toPagedListResult(items.slice(0, 1), 25, 5, 6)

    // Assert
    expect(result.shown).toBe(1)
    expect(result.hasMore).toBe(false)
  })

  it('should treat the received rows as the total when count is null', () => {
    // Arrange & Act
    const result = toPagedListResult(items, null, 1, 6)

    // Assert
    expect(result.total).toBe(6)
    expect(result.hasMore).toBe(false)
  })
})

describe('accumulatedRange', () => {
  it('should request exactly one page when page is one', () => {
    // Arrange & Act
    const result = accumulatedRange(1, 10)

    // Assert — range() 는 양끝 포함이라 0..9 가 10건이다.
    expect(result).toEqual({ from: 0, to: 9 })
  })

  it('should accumulate previous pages when page is greater than one', () => {
    // Arrange & Act
    const result = accumulatedRange(3, 10)

    // Assert
    expect(result).toEqual({ from: 0, to: 29 })
  })

  it('should keep the offset rows on top of the accumulated page when an offset is given', () => {
    // Arrange & Act — 랭킹: TOP3 + 표 10행
    const result = accumulatedRange(1, 10, 3)

    // Assert
    expect(result).toEqual({ from: 0, to: 12 })
  })

  it('should fall back to the first page when page is zero or negative', () => {
    // Arrange & Act
    const zero = accumulatedRange(0, 15)
    const negative = accumulatedRange(-5, 15)

    // Assert
    expect(zero).toEqual({ from: 0, to: 14 })
    expect(negative).toEqual({ from: 0, to: 14 })
  })

  it('should floor fractional pages when a decimal page is given', () => {
    // Arrange & Act
    const result = accumulatedRange(2.9, 10)

    // Assert
    expect(result).toEqual({ from: 0, to: 19 })
  })
})

describe('escapeLikePattern', () => {
  it('should escape wildcard characters when the query contains them', () => {
    // Arrange & Act
    const result = escapeLikePattern('100%_할인')

    // Assert
    expect(result).toBe('100\\%\\_할인')
  })

  it('should escape the escape character itself when a backslash is given', () => {
    // Arrange & Act
    const result = escapeLikePattern('a\\b')

    // Assert
    expect(result).toBe('a\\\\b')
  })

  it('should drop asterisks because PostgREST rewrites them to percent signs', () => {
    // Arrange & Act
    const result = escapeLikePattern('*점검*')

    // Assert
    expect(result).toBe('점검')
  })

  it('should leave a plain query untouched', () => {
    // Arrange & Act
    const result = escapeLikePattern('정기 점검')

    // Assert
    expect(result).toBe('정기 점검')
  })
})

describe('containsPattern', () => {
  it('should wrap the escaped query in percent signs when a query is given', () => {
    // Arrange & Act
    const result = containsPattern(' 점검 ')

    // Assert
    expect(result).toBe('%점검%')
  })

  it('should return null when the query is blank', () => {
    // Arrange & Act & Assert
    expect(containsPattern('')).toBeNull()
    expect(containsPattern('   ')).toBeNull()
  })
})

describe('toListResult', () => {
  const items = Array.from({ length: 10 }, (_, index) => index)

  it('should report more items when the total exceeds the loaded rows', () => {
    // Arrange & Act
    const result = toListResult(items, 22, 1, 10)

    // Assert
    expect(result).toEqual({ items, total: 22, shown: 10, page: 1, hasMore: true })
  })

  it('should stop reporting more items when everything is loaded', () => {
    // Arrange & Act
    const result = toListResult(items, 10, 5, 10)

    // Assert
    expect(result.shown).toBe(10)
    expect(result.hasMore).toBe(false)
  })

  it('should treat the received rows as the total when count is null', () => {
    // Arrange & Act
    const result = toListResult(items, null, 1, 10)

    // Assert
    expect(result.total).toBe(10)
    expect(result.hasMore).toBe(false)
  })

  it('should not report more rows than were actually received', () => {
    // Arrange — DB 가 요청보다 적게 돌려준 경우(마지막 페이지)
    const result = toListResult(items.slice(0, 2), 12, 2, 10)

    // Assert
    expect(result.shown).toBe(2)
  })

  it('should return an empty result when nothing matches', () => {
    // Arrange & Act
    const result = toListResult([], 0, 1, 10)

    // Assert
    expect(result).toEqual({ items: [], total: 0, shown: 0, page: 1, hasMore: false })
  })
})
