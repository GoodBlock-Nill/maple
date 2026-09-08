import { describe, expect, it } from 'vitest'

import { maskNickname } from '@/lib/utils/mask'

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
