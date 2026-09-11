import { describe, expect, it } from 'vitest'

import { accumulatedCount, clampPage, getPageRange, getTotalPages } from '@/lib/utils/pagination'

describe('getPageRange', () => {
  it('should return empty array when total is 0', () => {
    // Arrange
    const total = 0

    // Act
    const result = getPageRange(1, total)

    // Assert
    expect(result).toEqual([])
  })

  it('should return all pages when total equals size', () => {
    // Arrange
    const total = 5

    // Act
    const result = getPageRange(3, total, 5)

    // Assert
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  it('should return all pages when total is less than size', () => {
    // Arrange
    const total = 3

    // Act
    const result = getPageRange(1, total, 5)

    // Assert
    expect(result).toEqual([1, 2, 3])
  })

  it('should anchor range to the start when current page is near the beginning', () => {
    // Arrange
    const total = 20

    // Act
    const result = getPageRange(1, total, 5)

    // Assert
    expect(result).toEqual([1, 2, 3, 4, 5])
  })

  it('should center range around current page when current is in the middle', () => {
    // Arrange
    const total = 20

    // Act
    const result = getPageRange(10, total, 5)

    // Assert
    expect(result).toEqual([8, 9, 10, 11, 12])
  })

  it('should anchor range to the end when current page is near the last page', () => {
    // Arrange
    const total = 20

    // Act
    const result = getPageRange(20, total, 5)

    // Assert
    expect(result).toEqual([16, 17, 18, 19, 20])
  })

  it('should slide a five-wide window with the current page in the middle', () => {
    /* Arrange & Act & Assert — 내 문의 내역 페이지네이션(시안 v2)은 이 창을 그대로
       그린다. 창이 움직이지 않으면 6페이지째부터 현재 페이지가 목록에서 사라진다. */
    expect(getPageRange(3, 12, 5)).toEqual([1, 2, 3, 4, 5])
    expect(getPageRange(6, 12, 5)).toEqual([4, 5, 6, 7, 8])
    expect(getPageRange(12, 12, 5)).toEqual([8, 9, 10, 11, 12])
  })

  it('should use default size of 5 when size is not provided', () => {
    // Arrange
    const total = 20

    // Act
    const result = getPageRange(10, total)

    // Assert
    expect(result).toHaveLength(5)
  })
})

describe('getTotalPages', () => {
  it('should return 0 when count is 0', () => {
    // Arrange & Act
    const result = getTotalPages(0, 10)

    // Assert
    expect(result).toBe(0)
  })

  it('should return exact page count when count is evenly divisible by perPage', () => {
    // Arrange & Act
    const result = getTotalPages(20, 10)

    // Assert
    expect(result).toBe(2)
  })

  it('should round up when count is not evenly divisible by perPage', () => {
    // Arrange & Act
    const result = getTotalPages(25, 10)

    // Assert
    expect(result).toBe(3)
  })

  it('should return 0 when perPage is 0', () => {
    // Arrange & Act
    const result = getTotalPages(10, 0)

    // Assert
    expect(result).toBe(0)
  })
})

describe('clampPage', () => {
  it('should return 1 when page is less than 1', () => {
    // Arrange & Act
    const result = clampPage(0, 5)

    // Assert
    expect(result).toBe(1)
  })

  it('should return total when page exceeds total', () => {
    // Arrange & Act
    const result = clampPage(10, 5)

    // Assert
    expect(result).toBe(5)
  })

  it('should return page unchanged when page is within range', () => {
    // Arrange & Act
    const result = clampPage(3, 5)

    // Assert
    expect(result).toBe(3)
  })

  it('should return 1 when total is 0', () => {
    // Arrange & Act
    const result = clampPage(3, 0)

    // Assert
    expect(result).toBe(1)
  })
})

describe('accumulatedCount', () => {
  it('should return one page worth of items when page is 1', () => {
    // Arrange & Act
    const result = accumulatedCount(1, 10, 22)

    // Assert
    expect(result).toBe(10)
  })

  it('should accumulate previous pages when page is greater than 1', () => {
    // Arrange & Act
    const result = accumulatedCount(3, 10, 100)

    // Assert
    expect(result).toBe(30)
  })

  it('should clamp to total when the requested count exceeds it', () => {
    // Arrange & Act
    const result = accumulatedCount(5, 10, 22)

    // Assert
    expect(result).toBe(22)
  })

  it('should return 0 when total is 0', () => {
    // Arrange & Act
    const result = accumulatedCount(2, 10, 0)

    // Assert
    expect(result).toBe(0)
  })

  it('should treat page 0 as the first page when page is below 1', () => {
    // Arrange & Act
    const result = accumulatedCount(0, 10, 22)

    // Assert
    expect(result).toBe(10)
  })
})
