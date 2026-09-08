import { describe, expect, it } from 'vitest'

import { POST_IMAGE_MAX_BYTES } from '@/lib/supabase/storage'
import { validatePostImage } from '@/lib/validation/upload'

describe('validatePostImage', () => {
  it.each([['image/jpeg'], ['image/png'], ['image/webp'], ['image/gif']])(
    'should accept %s within the size limit',
    (type) => {
      // Arrange & Act
      const result = validatePostImage({ type, size: 1024 })

      // Assert
      expect(result).toEqual({ ok: true, mime: type })
    },
  )

  it('should reject an svg because it can carry a script', () => {
    // Arrange & Act
    const result = validatePostImage({ type: 'image/svg+xml', size: 1024 })

    // Assert
    expect(result.ok).toBe(false)
  })

  it('should reject a non image mime type', () => {
    // Arrange & Act
    const result = validatePostImage({ type: 'application/pdf', size: 1024 })

    // Assert
    expect(result.ok).toBe(false)
  })

  it('should reject a file over the bucket size limit', () => {
    // Arrange & Act
    const result = validatePostImage({ type: 'image/png', size: POST_IMAGE_MAX_BYTES + 1 })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.ok || result.message).toContain('MB')
  })

  it('should accept a file exactly at the limit', () => {
    // Arrange & Act — 경계값은 통과해야 한다(버킷 제한과 같은 판정)
    const result = validatePostImage({ type: 'image/png', size: POST_IMAGE_MAX_BYTES })

    // Assert
    expect(result.ok).toBe(true)
  })

  it('should reject an empty file', () => {
    // Arrange & Act — 0바이트는 깨진 이미지로 본문에 남는다
    const result = validatePostImage({ type: 'image/png', size: 0 })

    // Assert
    expect(result.ok).toBe(false)
  })
})
