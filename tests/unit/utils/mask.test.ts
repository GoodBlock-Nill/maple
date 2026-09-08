import { describe, expect, it } from 'vitest'

import { maskAccountId, maskNickname } from '@/lib/utils/mask'

describe('maskNickname', () => {
  it('should keep the first three characters when the nickname is long', () => {
    // Arrange & Act
    const result = maskNickname('cinnamon')

    // Assert
    expect(result).toBe('cin***')
  })

  it('should keep every character when the nickname is shorter than three', () => {
    // Arrange & Act
    const result = maskNickname('ab')

    // Assert
    expect(result).toBe('ab***')
  })

  it('should return only the mask when the nickname is blank', () => {
    // Arrange & Act
    const result = maskNickname('   ')

    // Assert
    expect(result).toBe('***')
  })
})

describe('maskAccountId', () => {
  it('should keep the first four and last three digits of a full account id', () => {
    // Arrange & Act
    const result = maskAccountId('123456789000000')

    // Assert
    expect(result).toBe('1234****000')
  })

  it('should mask everything but the first character when the id is short', () => {
    // Arrange & Act
    const result = maskAccountId('1234567')

    // Assert
    expect(result).toBe('1****')
  })

  it('should fall back to a placeholder when the id is missing', () => {
    // Arrange & Act & Assert — 접수 당시 계정 ID 를 적지 않은 문의도 있다.
    expect(maskAccountId(null)).toBe('-')
    expect(maskAccountId('   ')).toBe('-')
  })
})
