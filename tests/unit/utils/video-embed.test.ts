import { describe, expect, it } from 'vitest'

import {
  parseVideoToken,
  parseVideoUrl,
  toVideoToken,
  videoEmbedSrc,
  videoEmbedTitle,
} from '@/lib/utils/video-embed'

describe('parseVideoUrl — 유튜브', () => {
  it('should read the id from a watch url', () => {
    // Arrange & Act
    const result = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ')

    // Assert
    expect(result).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' })
  })

  it('should ignore extra query parameters on a watch url', () => {
    // Arrange & Act
    const result = parseVideoUrl('https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL1')

    // Assert
    expect(result).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' })
  })

  it('should read the id from a shorts url', () => {
    // Arrange & Act
    const result = parseVideoUrl('https://www.youtube.com/shorts/abc123XYZ_-')

    // Assert
    expect(result).toEqual({ provider: 'youtube', id: 'abc123XYZ_-' })
  })

  it('should read the id from a youtu.be short link with a timestamp', () => {
    // Arrange & Act
    const result = parseVideoUrl('https://youtu.be/dQw4w9WgXcQ?t=30')

    // Assert
    expect(result).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' })
  })

  it('should accept a mobile url', () => {
    // Arrange & Act
    const result = parseVideoUrl('https://m.youtube.com/watch?v=dQw4w9WgXcQ')

    // Assert
    expect(result).toEqual({ provider: 'youtube', id: 'dQw4w9WgXcQ' })
  })
})

describe('parseVideoUrl — Vimeo', () => {
  it('should read the id from a canonical url', () => {
    // Arrange & Act
    const result = parseVideoUrl('https://vimeo.com/123456789')

    // Assert
    expect(result).toEqual({ provider: 'vimeo', id: '123456789' })
  })

  it('should read the id from a channel url', () => {
    // Arrange & Act
    const result = parseVideoUrl('https://vimeo.com/channels/staffpicks/123456789')

    // Assert
    expect(result).toEqual({ provider: 'vimeo', id: '123456789' })
  })

  it('should read the id from a player url', () => {
    // Arrange & Act
    const result = parseVideoUrl('https://player.vimeo.com/video/123456789?h=abc')

    // Assert
    expect(result).toEqual({ provider: 'vimeo', id: '123456789' })
  })
})

describe('parseVideoUrl — 거절', () => {
  it.each([
    ['빈 문자열', ''],
    ['주소가 아닌 글', '그냥 텍스트'],
    ['javascript 스킴', 'javascript:alert(1)'],
    ['data 스킴', 'data:text/html,<script>alert(1)</script>'],
    ['지원하지 않는 호스트', 'https://vimeo.evil.example/123456789'],
    ['유튜브를 흉내 낸 호스트', 'https://evil.example/watch?v=dQw4w9WgXcQ'],
    ['id 가 없는 유튜브 주소', 'https://www.youtube.com/watch'],
    ['숫자가 아닌 Vimeo id', 'https://vimeo.com/notanid'],
    ['프로토콜 상대 주소', '//www.youtube.com/watch?v=dQw4w9WgXcQ'],
  ])('should reject %s', (_label, input) => {
    // Arrange & Act & Assert
    expect(parseVideoUrl(input)).toBeNull()
  })
})

describe('토큰 왕복', () => {
  it('should round trip a youtube embed', () => {
    // Arrange
    const embed = { provider: 'youtube', id: 'dQw4w9WgXcQ' } as const

    // Act & Assert
    expect(toVideoToken(embed)).toBe('youtube:dQw4w9WgXcQ')
    expect(parseVideoToken('youtube:dQw4w9WgXcQ')).toEqual(embed)
  })

  it.each([
    ['제공자를 모르는 토큰', 'tiktok:abc123'],
    ['구분자가 없는 토큰', 'youtube'],
    ['id 가 비어 있는 토큰', 'youtube:'],
    ['유튜브 id 형식을 벗어난 토큰', 'youtube:../../etc/passwd'],
    ['숫자가 아닌 Vimeo id', 'vimeo:abcdefg'],
    ['따옴표를 끼워 넣은 토큰', 'youtube:abc"onload="alert(1)'],
  ])('should reject %s', (_label, token) => {
    // Arrange & Act & Assert
    expect(parseVideoToken(token)).toBeNull()
  })
})

describe('videoEmbedSrc / videoEmbedTitle', () => {
  it('should build a cookie free youtube embed url', () => {
    // Arrange & Act
    const src = videoEmbedSrc({ provider: 'youtube', id: 'dQw4w9WgXcQ' })

    // Assert
    expect(src).toBe('https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ')
  })

  it('should build a vimeo player url', () => {
    // Arrange & Act
    const src = videoEmbedSrc({ provider: 'vimeo', id: '123456789' })

    // Assert
    expect(src).toBe('https://player.vimeo.com/video/123456789')
  })

  it('should give every iframe an accessible name', () => {
    // Arrange & Act & Assert
    expect(videoEmbedTitle({ provider: 'youtube', id: 'dQw4w9WgXcQ' })).toBe('YouTube 동영상')
    expect(videoEmbedTitle({ provider: 'vimeo', id: '123456789' })).toBe('Vimeo 동영상')
  })
})
