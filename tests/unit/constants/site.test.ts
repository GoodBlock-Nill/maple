import { existsSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { OG_IMAGE, SITE_DESCRIPTION, SITE_KEYWORDS } from '@/lib/constants/site'

describe('SITE_DESCRIPTION', () => {
  it('should carry the OG intro copy exactly', () => {
    // Arrange & Act & Assert
    expect(SITE_DESCRIPTION).toBe(
      '추억은 그대로, 감성은 더 새롭게 빅뱅 이후 그 시절 메이플 감성을 담은 글자월드에서 지금 다시, 우리의 추억을 플레이해보세요!',
    )
  })
})

describe('SITE_KEYWORDS', () => {
  it('should list the OG keywords in order', () => {
    // Arrange & Act & Assert
    expect(SITE_KEYWORDS).toEqual(['글자월드', '메이플스토리월드', 'MSW'])
  })
})

describe('OG_IMAGE', () => {
  it('should point at the moved og image with the 960x540 source size', () => {
    // Arrange & Act & Assert
    expect(OG_IMAGE).toEqual({
      url: '/images/og.png',
      width: 960,
      height: 540,
      alt: '글자월드 — 추억은 그대로, 감성은 더 새롭게',
    })
  })

  it('should ship the og image file at the referenced path', () => {
    // Arrange & Act
    const exists = existsSync(path.join(process.cwd(), 'public', OG_IMAGE.url))

    // Assert
    expect(exists).toBe(true)
  })
})
