import { describe, expect, it } from 'vitest'

import {
  COMMENT_CONTENT_MAX,
  createCommentSchema,
  createPostSchema,
  POST_CONTENT_MAX,
  POST_TITLE_MAX,
} from '@/lib/validation/post'

const validPost = { category: 'chat', title: '제목입니다', content: '본문입니다' }

describe('createPostSchema', () => {
  it('should accept a valid post', () => {
    // Arrange & Act
    const result = createPostSchema.safeParse(validPost)

    // Assert
    expect(result.success).toBe(true)
  })

  it('should reject a category that is not a community board key', () => {
    // Arrange & Act — 'notice' 는 뉴스 말머리다.
    const result = createPostSchema.safeParse({ ...validPost, category: 'notice' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a title made only of spaces', () => {
    // Arrange & Act
    const result = createPostSchema.safeParse({ ...validPost, title: '     ' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a title longer than the limit', () => {
    // Arrange & Act
    const result = createPostSchema.safeParse({
      ...validPost,
      title: 'a'.repeat(POST_TITLE_MAX + 1),
    })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject content shorter than the minimum', () => {
    // Arrange & Act
    const result = createPostSchema.safeParse({ ...validPost, content: '짧음' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject content longer than the limit', () => {
    // Arrange & Act
    const result = createPostSchema.safeParse({
      ...validPost,
      content: 'a'.repeat(POST_CONTENT_MAX + 1),
    })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should trim the title and content before storing', () => {
    // Arrange & Act
    const result = createPostSchema.safeParse({
      ...validPost,
      title: '  제목  ',
      content: '  본문입니다  ',
    })

    // Assert
    expect(result.success && result.data.title).toBe('제목')
    expect(result.success && result.data.content).toBe('본문입니다')
  })
})

describe('createCommentSchema', () => {
  const postId = '22222222-0000-4000-8000-000000000001'

  it('should accept a valid comment', () => {
    // Arrange & Act
    const result = createCommentSchema.safeParse({ postId, content: '좋은 글이네요' })

    // Assert
    expect(result.success).toBe(true)
  })

  it('should reject a post id that is not a uuid', () => {
    // Arrange & Act
    const result = createCommentSchema.safeParse({ postId: '42', content: '좋은 글' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject an empty comment', () => {
    // Arrange & Act
    const result = createCommentSchema.safeParse({ postId, content: '   ' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a comment longer than the limit', () => {
    // Arrange & Act
    const result = createCommentSchema.safeParse({
      postId,
      content: 'a'.repeat(COMMENT_CONTENT_MAX + 1),
    })

    // Assert
    expect(result.success).toBe(false)
  })
})
