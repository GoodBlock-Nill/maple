import { describe, expect, it } from 'vitest'

import { RANKING_PAGE_SIZE, TOP_RANK_COUNT } from '@/lib/constants/ranking'
import { getRankingList } from '@/lib/data/rankings'
import { RANKING_ENTRIES } from '@/lib/mock/rankings'

describe('getRankingList', () => {
  it('should split the first three entries into the top card area', async () => {
    // Arrange & Act
    const result = await getRankingList()

    // Assert
    expect(result.top).toHaveLength(TOP_RANK_COUNT)
    expect(result.top.map((entry) => entry.rank)).toEqual([1, 2, 3])
    expect(result.total).toBe(RANKING_ENTRIES.length)
  })

  it('should start the table at rank four with one page of rows', async () => {
    // Arrange & Act
    const result = await getRankingList()

    // Assert
    expect(result.rows).toHaveLength(RANKING_PAGE_SIZE)
    expect(result.rows[0]?.rank).toBe(4)
    expect(result.rows.at(-1)?.rank).toBe(3 + RANKING_PAGE_SIZE)
  })

  it('should accumulate previous pages when page is greater than 1', async () => {
    // Arrange & Act
    const result = await getRankingList({ page: 2 })

    // Assert
    expect(result.rows).toHaveLength(RANKING_PAGE_SIZE * 2)
    expect(result.rows.at(-1)?.rank).toBe(3 + RANKING_PAGE_SIZE * 2)
    expect(result.hasMore).toBe(true)
  })

  it('should stop reporting more rows when the last page is reached', async () => {
    // Arrange & Act
    const result = await getRankingList({ page: 99 })

    // Assert
    expect(result.shown).toBe(RANKING_ENTRIES.length - TOP_RANK_COUNT)
    expect(result.hasMore).toBe(false)
  })

  it('should drop guildless characters when the guild ranking is selected', async () => {
    // Arrange & Act
    const result = await getRankingList({ type: 'guild', page: 99 })

    // Assert
    expect(result.total).toBeLessThan(RANKING_ENTRIES.length)
    expect([...result.top, ...result.rows].every((entry) => entry.guild !== null)).toBe(true)
  })

  it('should keep every character when the job ranking is selected', async () => {
    // Arrange & Act
    const result = await getRankingList({ type: 'job' })

    // Assert
    expect(result.total).toBe(RANKING_ENTRIES.length)
  })

  it('should keep only the matching job group when a job is given', async () => {
    // Arrange & Act
    const result = await getRankingList({ job: 'demon', page: 99 })

    // Assert
    expect(result.total).toBeGreaterThan(0)
    expect([...result.top, ...result.rows].every((entry) => entry.jobGroup === 'demon')).toBe(true)
  })

  it('should renumber ranks from one after filtering', async () => {
    // Arrange & Act
    const result = await getRankingList({ job: 'hero', page: 99 })
    const ranks = [...result.top, ...result.rows].map((entry) => entry.rank)

    // Assert
    expect(ranks).toEqual(ranks.map((_, index) => index + 1))
  })

  it('should combine the type and job filters', async () => {
    // Arrange & Act
    const guildOnly = await getRankingList({ type: 'guild', job: 'cygnus', page: 99 })

    // Assert
    expect(
      [...guildOnly.top, ...guildOnly.rows].every(
        (entry) => entry.guild !== null && entry.jobGroup === 'cygnus',
      ),
    ).toBe(true)
  })

  it('should return an empty result when nothing matches the query', async () => {
    // Arrange & Act
    const result = await getRankingList({ q: '없는닉네임' })

    // Assert
    expect(result.top).toHaveLength(0)
    expect(result.rows).toHaveLength(0)
    expect(result.total).toBe(0)
    expect(result.hasMore).toBe(false)
  })
})
