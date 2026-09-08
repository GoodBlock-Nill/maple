import { describe, expect, it } from 'vitest'

import { extractYoutubeId, youtubeEmbedUrl, youtubeThumbnail } from '@/lib/utils/youtube'

describe('extractYoutubeId', () => {
  it('should read the id from a watch url', () => {
    // Arrange & Act
    const id = extractYoutubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    // Assert
    expect(id).toBe('dQw4w9WgXcQ')
  })

  it('should read the id from a short link', () => {
    // Arrange & Act
    const id = extractYoutubeId('https://youtu.be/dQw4w9WgXcQ?t=30')

    // Assert
    expect(id).toBe('dQw4w9WgXcQ')
  })

  it('should read the id from an embed url', () => {
    // Arrange & Act
    const id = extractYoutubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')

    // Assert
    expect(id).toBe('dQw4w9WgXcQ')
  })

  it('should return null when the url has no video id', () => {
    // Arrange & Act
    const id = extractYoutubeId('https://example.com/video')

    // Assert
    expect(id).toBeNull()
  })

  it('should return null when the input is empty', () => {
    // Arrange & Act
    const id = extractYoutubeId('')

    // Assert
    expect(id).toBeNull()
  })
})

describe('youtubeThumbnail', () => {
  it('should point at the max resolution still on the configured host', () => {
    // Arrange & Act
    const url = youtubeThumbnail('dQw4w9WgXcQ')

    // Assert
    expect(url).toBe('https://i.ytimg.com/vi/dQw4w9WgXcQ/maxresdefault.jpg')
  })
})

describe('youtubeEmbedUrl', () => {
  it('should autoplay and hide related videos', () => {
    // Arrange & Act
    const url = youtubeEmbedUrl('dQw4w9WgXcQ')

    // Assert
    expect(url).toContain('/embed/dQw4w9WgXcQ')
    expect(url).toContain('autoplay=1')
    expect(url).toContain('rel=0')
  })
})
