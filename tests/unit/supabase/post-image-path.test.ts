import { describe, expect, it } from 'vitest'

import {
  buildPostImagePath,
  isPostImageMime,
  isUserScopedPath,
  postImageFolder,
  postImagePublicUrlPrefix,
} from '@/lib/supabase/storage'

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const FILE_ID = 'bbbbbbbb-0000-4000-8000-000000000002'

describe('buildPostImagePath', () => {
  it('should place the object under {uid}/{yyyy} so the RLS policy passes', () => {
    // Arrange & Act
    const path = buildPostImagePath({ userId: USER_ID, mime: 'image/png', id: FILE_ID, year: 2026 })

    // Assert
    expect(path).toBe(`${USER_ID}/2026/${FILE_ID}.png`)
    expect(isUserScopedPath(path, USER_ID)).toBe(true)
  })

  it('should derive the extension from the mime type, not from the uploaded name', () => {
    // Arrange & Act
    const path = buildPostImagePath({
      userId: USER_ID,
      mime: 'image/jpeg',
      id: FILE_ID,
      year: 2026,
    })

    // Assert
    expect(path.endsWith('.jpg')).toBe(true)
  })

  it('should refuse a file name that is not a uuid', () => {
    // Arrange & Act & Assert — 원본 파일명이 새어 들어오면 경로 탈출이 가능해진다
    expect(() =>
      buildPostImagePath({
        userId: USER_ID,
        mime: 'image/png',
        id: '../../etc/passwd',
        year: 2026,
      }),
    ).toThrow()
  })

  it('should refuse an empty user id', () => {
    // Arrange & Act & Assert
    expect(() =>
      buildPostImagePath({ userId: '  ', mime: 'image/png', id: FILE_ID, year: 2026 }),
    ).toThrow()
  })

  it('should not be user scoped when the first segment belongs to someone else', () => {
    // Arrange
    const path = buildPostImagePath({ userId: USER_ID, mime: 'image/png', id: FILE_ID, year: 2026 })

    // Act & Assert
    expect(isUserScopedPath(path, 'cccccccc-0000-4000-8000-000000000003')).toBe(false)
  })
})

describe('postImageFolder', () => {
  it('should point at the current year folder of the user', () => {
    // Arrange & Act & Assert
    expect(postImageFolder(USER_ID, 2026)).toBe(`${USER_ID}/2026`)
  })
})

describe('postImagePublicUrlPrefix', () => {
  it('should build the public object prefix of the post-images bucket', () => {
    // Arrange & Act
    const prefix = postImagePublicUrlPrefix('https://stub.supabase.co')

    // Assert
    expect(prefix).toBe('https://stub.supabase.co/storage/v1/object/public/post-images/')
  })

  it('should not double the slash when the base url has a trailing one', () => {
    // Arrange & Act
    const prefix = postImagePublicUrlPrefix('https://stub.supabase.co/')

    // Assert
    expect(prefix).toBe('https://stub.supabase.co/storage/v1/object/public/post-images/')
  })
})

describe('isPostImageMime', () => {
  it('should accept only the bucket mime allow list', () => {
    // Arrange & Act & Assert
    expect(isPostImageMime('image/webp')).toBe(true)
    expect(isPostImageMime('image/svg+xml')).toBe(false)
    expect(isPostImageMime('text/html')).toBe(false)
  })
})
