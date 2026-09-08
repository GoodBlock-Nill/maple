import { describe, expect, it } from 'vitest'

import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CATEGORY_MAP,
  COMMUNITY_CATEGORY_VALUES,
  COMMUNITY_SORT_MAP,
  NEWS_CATEGORIES,
  NEWS_CATEGORY_MAP,
  NEWS_CATEGORY_VALUES,
  NEWS_VIEW_MAP,
} from '@/lib/constants/board'
import { BADGE_CLASS } from '@/lib/constants/categories'

describe('news category map', () => {
  it('should expose Korean labels when looked up by url value', () => {
    // Arrange & Act
    const labels = NEWS_CATEGORY_VALUES.map((value) => NEWS_CATEGORY_MAP[value].label)

    // Assert
    expect(labels).toEqual(['공지사항', '패치노트', '이벤트'])
  })

  it('should map every news category to a badge class when resolved', () => {
    // Arrange & Act
    const classes = NEWS_CATEGORIES.map((category) => BADGE_CLASS[category.badge])

    // Assert
    expect(classes).toEqual([
      'bg-tag-purple-bg text-tag-purple',
      'bg-tag-orange-bg text-tag-orange',
      'bg-tag-green-bg text-tag-green',
    ])
  })
})

describe('community category map', () => {
  it('should expose Korean labels when looked up by url value', () => {
    // Arrange & Act
    const labels = COMMUNITY_CATEGORY_VALUES.map((value) => COMMUNITY_CATEGORY_MAP[value].label)

    // Assert
    expect(labels).toEqual(['잡담', '질문', '정보'])
  })

  it('should map every community category to a badge class when resolved', () => {
    // Arrange & Act
    const classes = COMMUNITY_CATEGORIES.map((category) => BADGE_CLASS[category.badge])

    // Assert
    expect(classes).toEqual([
      'bg-tag-purple-bg text-tag-purple',
      'bg-tag-blue-bg text-tag-blue',
      'bg-tag-green-bg text-tag-green',
    ])
  })
})

describe('badge class map', () => {
  it('should use full static class strings when Tailwind scans them', () => {
    // Arrange
    const values = Object.values(BADGE_CLASS)

    // Act
    const hasInterpolation = values.some((value) => value.includes('${'))

    // Assert
    expect(hasInterpolation).toBe(false)
    expect(values.every((value) => value.startsWith('bg-'))).toBe(true)
  })
})

describe('option maps', () => {
  it('should label the default news view when resolved', () => {
    // Arrange & Act
    const result = NEWS_VIEW_MAP.tile.label

    // Assert — 시안(notice.png) 트리거 표기가 "카드형"이다.
    expect(result).toBe('카드형')
  })

  it('should label the default community sort when resolved', () => {
    // Arrange & Act
    const result = COMMUNITY_SORT_MAP.latest.label

    // Assert
    expect(result).toBe('최신순')
  })
})
