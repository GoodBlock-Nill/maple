import { describe, expect, it } from 'vitest'

import { getCommunityList, getPostById } from '@/lib/data/community'
import { getNewsById, getNewsList } from '@/lib/data/news'

describe('getNewsList', () => {
  it('should return the first ten items when no filters are given', async () => {
    // Arrange & Act
    const result = await getNewsList()

    // Assert
    expect(result.items).toHaveLength(10)
    expect(result.total).toBe(22)
    expect(result.shown).toBe(10)
    expect(result.hasMore).toBe(true)
  })

  it('should accumulate previous pages when page is greater than 1', async () => {
    // Arrange & Act
    const result = await getNewsList({ page: 2 })

    // Assert
    expect(result.items).toHaveLength(20)
    expect(result.shown).toBe(20)
  })

  it('should stop reporting more items when the last page is reached', async () => {
    // Arrange & Act
    const result = await getNewsList({ page: 3 })

    // Assert
    expect(result.items).toHaveLength(22)
    expect(result.hasMore).toBe(false)
  })

  it('should keep only the matching category when a category is given', async () => {
    // Arrange & Act
    const result = await getNewsList({ category: 'patch' })

    // Assert
    expect(result.total).toBe(6)
    expect(result.items.every((item) => item.category === 'patch')).toBe(true)
  })

  it('should sort items newest first when the default order is used', async () => {
    // Arrange & Act
    const result = await getNewsList({ page: 3 })
    const dates = result.items.map((item) => item.publishedAt)

    // Assert
    expect([...dates].sort().reverse()).toEqual(dates)
  })

  it('should filter by title when a search query is given', async () => {
    // Arrange & Act
    const result = await getNewsList({ q: '점검' })

    // Assert
    expect(result.total).toBeGreaterThan(0)
    expect(result.items.every((item) => `${item.title}${item.summary}`.includes('점검'))).toBe(true)
  })

  it('should return an empty result when nothing matches the query', async () => {
    // Arrange & Act
    const result = await getNewsList({ q: '존재하지않는키워드' })

    // Assert
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })
})

describe('getNewsById', () => {
  it('should return the item when the id exists', async () => {
    // Arrange & Act
    const result = await getNewsById('1')

    // Assert
    expect(result?.id).toBe('1')
  })

  it('should return null when the id is unknown', async () => {
    // Arrange & Act
    const result = await getNewsById('999')

    // Assert
    expect(result).toBeNull()
  })
})

describe('getCommunityList', () => {
  it('should return the first ten posts of one hundred when no filters are given', async () => {
    // Arrange & Act
    const result = await getCommunityList()

    // Assert
    expect(result.items).toHaveLength(10)
    expect(result.total).toBe(100)
    expect(result.hasMore).toBe(true)
  })

  it('should order posts by views when sort is views', async () => {
    // Arrange & Act
    const result = await getCommunityList({ sort: 'views' })
    const views = result.items.map((post) => post.views)

    // Assert
    expect([...views].sort((a, b) => b - a)).toEqual(views)
  })

  it('should order posts by likes when sort is likes', async () => {
    // Arrange & Act
    const result = await getCommunityList({ sort: 'likes' })
    const likes = result.items.map((post) => post.likes)

    // Assert
    expect([...likes].sort((a, b) => b - a)).toEqual(likes)
  })

  it('should keep only the matching category when a category is given', async () => {
    // Arrange & Act
    const result = await getCommunityList({ category: 'question' })

    // Assert
    expect(result.items.every((post) => post.category === 'question')).toBe(true)
  })

  it('should produce the same values on repeated calls when the seed is fixed', async () => {
    // Arrange & Act
    const first = await getCommunityList()
    const second = await getCommunityList()

    // Assert
    expect(first.items.map((post) => post.views)).toEqual(second.items.map((post) => post.views))
  })
})

describe('getPostById', () => {
  it('should return the post when the id exists', async () => {
    // Arrange & Act
    const result = await getPostById('42')

    // Assert
    expect(result?.id).toBe('42')
  })

  it('should return null when the id is unknown', async () => {
    // Arrange & Act
    const result = await getPostById('101')

    // Assert
    expect(result).toBeNull()
  })
})
