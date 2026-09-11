import { describe, expect, it } from 'vitest'

import { truncateFileBase } from '@/lib/utils/file-name'

/**
 * 파일 칩의 이름 표기(시안 v2).
 *
 * 칩은 한 줄에 여러 개가 흐르므로 이름이 길어도 폭이 무너지면 안 된다. 자르는
 * 쪽은 **앞부분**이다 — 확장자를 잃으면 "무슨 파일인지"를 알 수 없다.
 */
describe('truncateFileBase', () => {
  it('should keep a short name untouched', () => {
    // Arrange & Act & Assert
    expect(truncateFileBase('shot.png')).toBe('shot.png')
    expect(truncateFileBase('abcdef.png')).toBe('abcdef.png')
  })

  it('should ellipsise only the part before the extension', () => {
    // Arrange & Act & Assert — 7자부터 줄인다(기본 6자).
    expect(truncateFileBase('abcdefg.png')).toBe('abcdef….png')
    expect(truncateFileBase('스크린샷-2026-09-11.jpeg')).toBe('스크린샷-2….jpeg')
  })

  it('should keep names without an extension readable', () => {
    // Arrange & Act & Assert — 확장자가 없으면 붙일 것도 없다.
    expect(truncateFileBase('README')).toBe('README')
    expect(truncateFileBase('CHANGELOG')).toBe('CHANGE…')
  })

  it('should treat a leading dot as part of the name', () => {
    // Arrange & Act & Assert — `.env` 는 확장자가 아니라 이름이다.
    expect(truncateFileBase('.gitignore')).toBe('.gitig…')
  })

  it('should honour a custom visible length', () => {
    // Arrange & Act & Assert
    expect(truncateFileBase('abcdefg.png', 3)).toBe('abc….png')
  })
})
