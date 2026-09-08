import { describe, expect, it } from 'vitest'

import { GACHA_PAGE_SIZE, GACHA_TAB_VALUES } from '@/lib/constants/guide'
import { getGachaItemById, getGachaList } from '@/lib/data/gacha'
import { GACHA_ITEMS } from '@/lib/mock/gacha'

describe('getGachaList', () => {
  it('should keep only the default tab when no filters are given', async () => {
    // Arrange & Act
    const result = await getGachaList()

    // Assert
    expect(result.items).toHaveLength(GACHA_PAGE_SIZE)
    expect(result.items.every((item) => item.tab === 'premium')).toBe(true)
    expect(result.hasMore).toBe(true)
  })

  it('should keep only the matching tab when a tab is given', async () => {
    // Arrange & Act
    const result = await getGachaList({ tab: 'cube' })

    // Assert
    expect(result.items.every((item) => item.tab === 'cube')).toBe(true)
    expect(result.total).toBe(GACHA_ITEMS.filter((item) => item.tab === 'cube').length)
  })

  it('should split every item into exactly one tab', async () => {
    // Arrange & Act
    const totals = await Promise.all(
      GACHA_TAB_VALUES.map(async (tab) => (await getGachaList({ tab })).total),
    )

    // Assert
    expect(totals.reduce((sum, total) => sum + total, 0)).toBe(GACHA_ITEMS.length)
    expect(totals.every((total) => total > 0)).toBe(true)
  })

  it('should accumulate previous pages when page is greater than 1', async () => {
    // Arrange & Act
    const result = await getGachaList({ page: 2 })

    // Assert
    expect(result.items).toHaveLength(GACHA_PAGE_SIZE * 2)
    expect(result.shown).toBe(GACHA_PAGE_SIZE * 2)
  })

  it('should stop reporting more items when every item is shown', async () => {
    // Arrange & Act
    const result = await getGachaList({ page: 99 })

    // Assert
    expect(result.shown).toBe(result.total)
    expect(result.hasMore).toBe(false)
  })

  it('should keep only matching names when a query is given', async () => {
    // Arrange & Act
    const result = await getGachaList({ tab: 'cube', q: '레드' })

    // Assert
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.every((item) => item.name.includes('레드'))).toBe(true)
  })

  it('should return an empty list when nothing matches the query', async () => {
    // Arrange & Act
    const result = await getGachaList({ q: '존재하지않는아이템' })

    // Assert
    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })

  it('should order items by probability descending when the probability sort is used', async () => {
    // Arrange & Act
    const result = await getGachaList({ sort: 'probability', page: 99 })
    const values = result.items.map((item) => Number(item.probability))

    // Assert
    expect([...values].sort((a, b) => b - a)).toEqual(values)
  })
})

describe('getGachaItemById', () => {
  it('should return the matching item when the id exists', async () => {
    // Arrange & Act
    const item = await getGachaItemById('premium-1')

    // Assert
    expect(item?.id).toBe('premium-1')
    expect(item?.rows.length).toBeGreaterThan(0)
  })

  it('should return null when the id is unknown', async () => {
    // Arrange & Act
    const item = await getGachaItemById('does-not-exist')

    // Assert
    expect(item).toBeNull()
  })
})

describe('GACHA_ITEMS', () => {
  it('should make every detail table add up to 100 percent', () => {
    // Arrange & Act
    const sums = GACHA_ITEMS.map((item) =>
      item.rows.reduce((total, row) => total + Number(row.probability), 0),
    )

    // Assert
    expect(sums.every((sum) => Math.abs(sum - 100) < 0.001)).toBe(true)
  })

  it('should give every item a unique id', () => {
    // Arrange & Act
    const ids = GACHA_ITEMS.map((item) => item.id)

    // Assert
    expect(new Set(ids).size).toBe(ids.length)
  })
})
