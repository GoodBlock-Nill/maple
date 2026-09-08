import { describe, expect, it } from 'vitest'

import { DEFAULT_GACHA_SORT, GACHA_SORT_VALUES, GACHA_SORTS } from '@/lib/constants/guide'
import { parseOption } from '@/lib/utils/list-query'

describe('GACHA_SORTS', () => {
  it('should list latest, prob_desc, prob_asc in that order', () => {
    // Arrange & Act
    const values = GACHA_SORTS.map((sort) => sort.value)
    const labels = GACHA_SORTS.map((sort) => sort.label)

    // Assert — 드롭다운 노출 순서: 최신순 → 확률 높은순 → 확률 낮은순
    expect(values).toEqual(['latest', 'prob_desc', 'prob_asc'])
    expect(labels).toEqual(['최신순', '확률 높은순', '확률 낮은순'])
  })
})

describe('?sort= fallback (via parseOption)', () => {
  it('should keep a known sort value', () => {
    // Arrange & Act
    const result = parseOption('prob_asc', GACHA_SORT_VALUES, DEFAULT_GACHA_SORT)

    // Assert
    expect(result).toBe('prob_asc')
  })

  it('should fall back to latest when the value is the legacy "probability"', () => {
    // Arrange & Act
    const result = parseOption('probability', GACHA_SORT_VALUES, DEFAULT_GACHA_SORT)

    // Assert
    expect(result).toBe('latest')
  })

  it('should fall back to latest when the value is the legacy "name"', () => {
    // Arrange & Act
    const result = parseOption('name', GACHA_SORT_VALUES, DEFAULT_GACHA_SORT)

    // Assert
    expect(result).toBe('latest')
  })

  it('should fall back to latest when the value is missing', () => {
    // Arrange & Act
    const result = parseOption(undefined, GACHA_SORT_VALUES, DEFAULT_GACHA_SORT)

    // Assert
    expect(result).toBe('latest')
  })
})
