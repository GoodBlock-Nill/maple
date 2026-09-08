import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { absoluteUrl, siteOrigin } from '@/lib/utils/absolute-url'

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL

describe('absoluteUrl', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL
  })

  it('should prefix the site origin when the path is relative', () => {
    // Arrange & Act
    const result = absoluteUrl('/images/news/banners/notice.png')

    // Assert
    expect(result).toBe('https://example.com/images/news/banners/notice.png')
  })

  it('should not double the slash when the origin has a trailing one', () => {
    // Arrange
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/'

    // Act
    const result = absoluteUrl('/images/news/banners/info.png')

    // Assert
    expect(result).toBe('https://example.com/images/news/banners/info.png')
  })

  it('should keep the value when it is already absolute', () => {
    // Arrange & Act
    const result = absoluteUrl('https://cdn.example.com/a.png')

    // Assert
    expect(result).toBe('https://cdn.example.com/a.png')
  })

  it('should fall back to localhost when the env var is empty', () => {
    // Arrange
    process.env.NEXT_PUBLIC_SITE_URL = '  '

    // Act
    const result = siteOrigin()

    // Assert — OG 미리보기가 깨지는 대신 개발 주소로라도 절대 URL 을 만든다.
    expect(result).toBe('http://localhost:3000')
  })
})
