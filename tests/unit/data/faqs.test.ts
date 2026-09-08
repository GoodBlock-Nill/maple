import { describe, expect, it } from 'vitest'

import { FAQ_CATEGORY_VALUES } from '@/lib/constants/support'
import { getFaqGroups } from '@/lib/data/faqs'
import { FAQ_ITEMS } from '@/lib/mock/faqs'

describe('getFaqGroups', () => {
  it('should keep every item exactly once when grouping', async () => {
    // Arrange & Act
    const groups = await getFaqGroups()
    const ids = groups.flatMap((group) => group.items.map((item) => item.id))

    // Assert
    expect(ids).toHaveLength(FAQ_ITEMS.length)
    expect(new Set(ids).size).toBe(FAQ_ITEMS.length)
  })

  it('should put every item under its own category', async () => {
    // Arrange & Act
    const groups = await getFaqGroups()

    // Assert
    expect(
      groups.every((group) => group.items.every((item) => item.category === group.category)),
    ).toBe(true)
  })

  it('should follow the declared category order', async () => {
    // Arrange & Act
    const groups = await getFaqGroups()
    const order = groups.map((group) => group.category)

    // Assert
    expect(order).toEqual(FAQ_CATEGORY_VALUES.filter((value) => order.includes(value)))
  })

  it('should drop categories that have no items', async () => {
    // Arrange & Act
    const groups = await getFaqGroups()

    // Assert
    expect(groups.every((group) => group.items.length > 0)).toBe(true)
  })

  it('should expose a label for each group', async () => {
    // Arrange & Act
    const groups = await getFaqGroups()

    // Assert
    expect(groups.every((group) => group.label.length > 0)).toBe(true)
  })
})
