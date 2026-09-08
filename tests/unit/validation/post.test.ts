import { describe, expect, it } from 'vitest'

import {
  COMMENT_CONTENT_MAX,
  createCommentSchema,
  createPostSchema,
  POST_CONTENT_MAX,
  POST_TITLE_MAX,
} from '@/lib/validation/post'

/** 본문은 정제를 마친 HTML 이 들어온다(서버 액션이 `sanitizePostHtml` 을 먼저 돌린다). */
const validPost = { category: 'chat', title: '제목입니다', content: '<p>본문입니다</p>' }

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

  it('should reject an empty document that only carries editor scaffolding', () => {
    // Arrange & Act — 빈 에디터가 내놓는 마크업
    const result = createPostSchema.safeParse({ ...validPost, content: '<p></p>' })

    // Assert
    expect(result.success).toBe(false)
    expect(result.success || result.error.issues[0]?.message).toBe('내용을 입력해 주세요.')
  })

  it('should accept a post that carries only an image', () => {
    // Arrange & Act — 사진만 올리는 글은 정상적인 사용 방식이다
    const result = createPostSchema.safeParse({
      ...validPost,
      content:
        '<img src="https://cdn.example/storage/v1/object/public/post-images/a/b.png" alt="" />',
    })

    // Assert
    expect(result.success).toBe(true)
  })

  it('should accept a post that carries only a video placeholder', () => {
    // Arrange & Act
    const result = createPostSchema.safeParse({
      ...validPost,
      content: '<div data-video="youtube:dQw4w9WgXcQ"></div>',
    })

    // Assert
    expect(result.success).toBe(true)
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
      content: '  <p>본문입니다</p>  ',
    })

    // Assert
    expect(result.success && result.data.title).toBe('제목')
    expect(result.success && result.data.content).toBe('<p>본문입니다</p>')
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
