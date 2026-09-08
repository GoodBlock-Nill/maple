import { describe, expect, it } from 'vitest'

import {
  COMMUNITY_CATEGORIES,
  COMMUNITY_CATEGORY_MAP,
  COMMUNITY_CATEGORY_VALUES,
  COMMUNITY_SORT_MAP,
  NEWS_CATEGORIES,
  NEWS_CATEGORY_MAP,
  NEWS_CATEGORY_VALUES,
} from '@/lib/constants/board'
import { BADGE_CLASS } from '@/lib/constants/categories'

describe('news category map', () => {
  it('should expose Korean labels when looked up by url value', () => {
    // Arrange & Act
    const labels = NEWS_CATEGORY_VALUES.map((value) => NEWS_CATEGORY_MAP[value].label)

    // Assert
    expect(labels).toEqual([
      '공지사항',
      '점검안내',
      '업데이트 안내',
      '패치노트',
      '이벤트',
      '안내사항',
    ])
  })

  it('should keep the designed chip order when listed', () => {
    // Arrange & Act
    const values = NEWS_CATEGORIES.map((category) => category.value)

    // Assert
    expect(values).toEqual(['notice', 'maintenance', 'update', 'patch', 'event', 'info'])
  })

  it('should map every news category to a badge class when resolved', () => {
    // Arrange & Act
    const classes = NEWS_CATEGORIES.map((category) => BADGE_CLASS[category.badge])

    // Assert
    expect(classes).toEqual([
      'bg-tag-purple-bg text-tag-purple',
      'bg-tag-blue-bg text-tag-blue',
      'bg-tag-cyan-bg text-tag-cyan',
      'bg-tag-orange-bg text-tag-orange',
      'bg-tag-green-bg text-tag-green',
      'bg-tag-pink-bg text-tag-pink',
    ])
  })

  it('should not reuse the community badge token for 안내사항 when both keys are "info"', () => {
    // Arrange
    const newsInfo = NEWS_CATEGORY_MAP.info

    // Act
    const newsClass = BADGE_CLASS[newsInfo.badge]

    // Assert — 같은 'info' 키지만 색이 겹치면 두 게시판이 구분되지 않는다.
    expect(newsInfo.badge).toBe('news-info')
    expect(newsClass).not.toBe(BADGE_CLASS[COMMUNITY_CATEGORY_MAP.info.badge])
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
  it('should label the default community sort when resolved', () => {
    // Arrange & Act
    const result = COMMUNITY_SORT_MAP.latest.label

    // Assert
    expect(result).toBe('최신순')
  })
})
