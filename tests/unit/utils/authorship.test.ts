import { describe, expect, it } from 'vitest'

import { isAuthor, isEdited } from '@/lib/utils/authorship'

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER_ID = 'aaaaaaaa-0000-4000-8000-000000000002'
const CREATED_AT = '2026-05-19T10:00:00.000Z'

describe('isAuthor', () => {
  it('should recognize the author when both ids match', () => {
    // Arrange & Act
    const result = isAuthor(USER_ID, USER_ID)

    // Assert
    expect(result).toBe(true)
  })

  it('should reject a different user', () => {
    // Arrange & Act
    const result = isAuthor(USER_ID, OTHER_ID)

    // Assert
    expect(result).toBe(false)
  })

  it('should not treat a withdrawn author as the viewer when both ids are null', () => {
    // Arrange — 탈퇴하면 author_id 가 null 이 되고, 비로그인 뷰어도 null 이다.
    // Act
    const result = isAuthor(null, null)

    // Assert
    expect(result).toBe(false)
  })

  it('should reject empty strings so a blank cookie cannot claim authorship', () => {
    // Arrange & Act & Assert
    expect(isAuthor('', '')).toBe(false)
    expect(isAuthor(USER_ID, '')).toBe(false)
    expect(isAuthor(undefined, USER_ID)).toBe(false)
  })
})

describe('isEdited', () => {
  it('should stay false for a post that was never edited', () => {
    // Arrange & Act — 한 번도 고치지 않은 글은 edited_at 이 null 이다.
    const result = isEdited(null)

    // Assert
    expect(result).toBe(false)
  })

  it('should report an edit once edited_at is filled', () => {
    // Arrange & Act
    const result = isEdited(CREATED_AT)

    // Assert
    expect(result).toBe(true)
  })

  it('should ignore a view count bump that only moves updated_at', () => {
    /* Arrange — increment_post_view() 는 view_count 만 올리므로
       mark_post_edited() 가 돌지 않고 edited_at 은 null 로 남는다. */
    const editedAt = null

    // Act
    const result = isEdited(editedAt)

    // Assert
    expect(result).toBe(false)
  })

  it('should stay false for unparsable or empty values', () => {
    // Arrange & Act & Assert
    expect(isEdited('not-a-date')).toBe(false)
    expect(isEdited('')).toBe(false)
    expect(isEdited(undefined)).toBe(false)
  })
})
