import { describe, expect, it } from 'vitest'

import { toggleLikeState } from '@/lib/utils/like-state'

describe('toggleLikeState', () => {
  it('should add one when the viewer had not liked the post', () => {
    // Arrange
    const state = { liked: false, likeCount: 3 }

    // Act
    const result = toggleLikeState(state)

    // Assert
    expect(result).toEqual({ liked: true, likeCount: 4 })
  })

  it('should take one back when the viewer had liked the post', () => {
    // Arrange
    const state = { liked: true, likeCount: 4 }

    // Act
    const result = toggleLikeState(state)

    // Assert
    expect(result).toEqual({ liked: false, likeCount: 3 })
  })

  it('should never fall below zero', () => {
    // Arrange — 시드 글처럼 집계와 실제 행이 어긋난 경우
    const state = { liked: true, likeCount: 0 }

    // Act
    const result = toggleLikeState(state)

    // Assert
    expect(result).toEqual({ liked: false, likeCount: 0 })
  })

  it('should return to the original state after two toggles', () => {
    // Arrange
    const state = { liked: false, likeCount: 7 }

    // Act
    const result = toggleLikeState(toggleLikeState(state))

    // Assert
    expect(result).toEqual(state)
  })

  it('should not mutate the given state', () => {
    // Arrange
    const state = { liked: false, likeCount: 1 }

    // Act
    toggleLikeState(state)

    // Assert
    expect(state).toEqual({ liked: false, likeCount: 1 })
  })
})
