import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { newsShareUrl, resolveShareMode } from '@/lib/utils/share'

const ORIGINAL = process.env.NEXT_PUBLIC_SITE_URL

describe('newsShareUrl', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com'
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_SITE_URL = ORIGINAL
  })

  it('should build the canonical detail url when given a post id', () => {
    // Arrange & Act
    const result = newsShareUrl('11111111-0000-4000-8000-000000000023')

    // Assert
    expect(result).toBe('https://example.com/news/11111111-0000-4000-8000-000000000023')
  })

  it('should keep the site origin when it has a trailing slash', () => {
    // Arrange
    process.env.NEXT_PUBLIC_SITE_URL = 'https://example.com/'

    // Act
    const result = newsShareUrl('abc')

    // Assert
    expect(result).toBe('https://example.com/news/abc')
  })
})

describe('resolveShareMode', () => {
  it('should prefer the os share sheet when navigator.share exists', () => {
    // Arrange & Act
    const result = resolveShareMode({ canShare: true, canCopy: true })

    // Assert
    expect(result).toBe('share')
  })

  it('should copy to the clipboard when only the clipboard is available', () => {
    // Arrange & Act
    const result = resolveShareMode({ canShare: false, canCopy: true })

    // Assert
    expect(result).toBe('copy')
  })

  it('should reveal the url when neither api is available', () => {
    // Arrange & Act
    const result = resolveShareMode({ canShare: false, canCopy: false })

    // Assert — 아무 일도 일어나지 않는 버튼이 되지 않게 하는 마지막 경로다.
    expect(result).toBe('reveal')
  })
})
