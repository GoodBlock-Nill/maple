import { describe, expect, it } from 'vitest'

import {
  hasViewedPost,
  isPostId,
  parseViewedPosts,
  serializeViewedPosts,
  VIEW_COOKIE_CAPACITY,
  withViewedPost,
} from '@/lib/actions/view-guard'

const ID_A = '11111111-0000-4000-8000-000000000001'
const ID_B = '11111111-0000-4000-8000-000000000002'

function makeId(index: number): string {
  return `11111111-0000-4000-8000-${index.toString().padStart(12, '0')}`
}

describe('isPostId', () => {
  it('should accept a uuid', () => {
    // Arrange & Act & Assert
    expect(isPostId(ID_A)).toBe(true)
  })

  it('should reject anything that is not a uuid', () => {
    // Arrange & Act & Assert
    expect(isPostId('42')).toBe(false)
    expect(isPostId('')).toBe(false)
    expect(isPostId(`${ID_A};drop`)).toBe(false)
  })
})

describe('parseViewedPosts', () => {
  it('should return an empty list when the cookie is missing', () => {
    // Arrange & Act & Assert
    expect(parseViewedPosts(undefined)).toEqual([])
    expect(parseViewedPosts('')).toEqual([])
  })

  it('should split the cookie on commas', () => {
    // Arrange & Act
    const result = parseViewedPosts(`${ID_A},${ID_B}`)

    // Assert
    expect(result).toEqual([ID_A, ID_B])
  })

  it('should drop entries that are not uuids when the cookie was tampered with', () => {
    // Arrange & Act
    const result = parseViewedPosts(`${ID_A},garbage,${ID_B}`)

    // Assert
    expect(result).toEqual([ID_A, ID_B])
  })

  it('should cap the parsed list at the capacity', () => {
    // Arrange
    const raw = Array.from({ length: VIEW_COOKIE_CAPACITY + 10 }, (_, i) => makeId(i)).join(',')

    // Act
    const result = parseViewedPosts(raw)

    // Assert
    expect(result).toHaveLength(VIEW_COOKIE_CAPACITY)
  })
})

describe('withViewedPost', () => {
  it('should put the newest post first', () => {
    // Arrange & Act
    const result = withViewedPost([ID_A], ID_B)

    // Assert
    expect(result).toEqual([ID_B, ID_A])
  })

  it('should not store the same post twice', () => {
    // Arrange & Act
    const result = withViewedPost([ID_A, ID_B], ID_B)

    // Assert
    expect(result).toEqual([ID_B, ID_A])
  })

  it('should evict the oldest entry when the capacity is exceeded', () => {
    // Arrange — 목록에 없는 새 글을 넣어야 밀려나는 항목이 생긴다.
    const full = Array.from({ length: VIEW_COOKIE_CAPACITY }, (_, i) => makeId(i + 100))
    const fresh = makeId(999)

    // Act
    const result = withViewedPost(full, fresh)

    // Assert
    expect(result).toHaveLength(VIEW_COOKIE_CAPACITY)
    expect(result[0]).toBe(fresh)
    expect(result).not.toContain(full.at(-1))
  })
})

describe('hasViewedPost', () => {
  it('should report a post that is already in the list', () => {
    // Arrange & Act & Assert
    expect(hasViewedPost([ID_A], ID_A)).toBe(true)
    expect(hasViewedPost([ID_A], ID_B)).toBe(false)
  })
})

describe('serializeViewedPosts', () => {
  it('should round trip through parse', () => {
    // Arrange
    const viewed = [ID_A, ID_B]

    // Act
    const result = parseViewedPosts(serializeViewedPosts(viewed))

    // Assert
    expect(result).toEqual(viewed)
  })
})
