import { describe, expect, it } from 'vitest'

import { isRlsViolation, isUniqueViolation } from '@/lib/actions/pg-error'

describe('isUniqueViolation', () => {
  it('should detect the duplicate report constraint by code', () => {
    // Arrange
    const error = { code: '23505', message: 'duplicate key value violates unique constraint' }

    // Act & Assert
    expect(isUniqueViolation(error)).toBe(true)
  })

  it('should ignore other postgres codes', () => {
    // Arrange & Act & Assert
    expect(isUniqueViolation({ code: '23503' })).toBe(false)
    expect(isUniqueViolation({ code: '42501' })).toBe(false)
  })

  it('should stay false for null and shapes without a code', () => {
    // Arrange & Act & Assert
    expect(isUniqueViolation(null)).toBe(false)
    expect(isUniqueViolation(undefined)).toBe(false)
    expect(isUniqueViolation({ message: 'boom' })).toBe(false)
    expect(isUniqueViolation('23505')).toBe(false)
  })
})

describe('isRlsViolation', () => {
  it('should detect an RLS rejection', () => {
    // Arrange & Act & Assert
    expect(isRlsViolation({ code: '42501' })).toBe(true)
    expect(isRlsViolation({ code: '23505' })).toBe(false)
  })
})
