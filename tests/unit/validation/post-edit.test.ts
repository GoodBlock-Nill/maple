import { describe, expect, it } from 'vitest'

import {
  commentIdSchema,
  createPostSchema,
  POST_TITLE_MAX,
  postIdSchema,
  updatePostSchema,
} from '@/lib/validation/post'

const POST_ID = '22222222-0000-4000-8000-000000000001'

describe('updatePostSchema', () => {
  it('should share the create rules so a post never becomes uneditable', () => {
    // Arrange
    const valid = { category: 'chat', title: '제목입니다', content: '<p>본문입니다</p>' }

    // Act & Assert — 같은 입력이면 두 스키마의 판정이 항상 같아야 한다.
    expect(updatePostSchema.safeParse(valid).success).toBe(
      createPostSchema.safeParse(valid).success,
    )
  })

  it('should reject a title over the limit', () => {
    // Arrange & Act
    const result = updatePostSchema.safeParse({
      category: 'chat',
      title: 'ㄱ'.repeat(POST_TITLE_MAX + 1),
      content: '<p>본문입니다</p>',
    })

    // Assert
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['title'])
  })

  it('should reject a news category so the news board stays admin only', () => {
    // Arrange & Act
    const result = updatePostSchema.safeParse({
      category: 'notice',
      title: '제목입니다',
      content: '<p>본문입니다</p>',
    })

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('postIdSchema / commentIdSchema', () => {
  it('should accept a uuid', () => {
    // Arrange & Act & Assert
    expect(postIdSchema.safeParse(POST_ID).success).toBe(true)
    expect(commentIdSchema.safeParse(POST_ID).success).toBe(true)
  })

  it('should reject anything that is not a uuid', () => {
    // Arrange & Act & Assert
    expect(postIdSchema.safeParse('42').success).toBe(false)
    expect(postIdSchema.safeParse('').success).toBe(false)
    expect(commentIdSchema.safeParse('../../etc/passwd').success).toBe(false)
  })
})
