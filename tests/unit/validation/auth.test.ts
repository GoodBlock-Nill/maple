import { describe, expect, it } from 'vitest'

import {
  DEFAULT_NEXT_PATH,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  sanitizeNextPath,
} from '@/lib/validation/auth'

describe('loginSchema', () => {
  it('should accept a valid email and password', () => {
    // Arrange & Act
    const result = loginSchema.safeParse({ email: 'user@example.com', password: 'password' })

    // Assert
    expect(result.success).toBe(true)
  })

  it('should trim the email so a pasted value with spaces still matches', () => {
    // Arrange & Act
    const result = loginSchema.safeParse({ email: '  user@example.com  ', password: 'x' })

    // Assert
    expect(result.success && result.data.email).toBe('user@example.com')
  })

  it('should reject a malformed email', () => {
    // Arrange & Act
    const result = loginSchema.safeParse({ email: 'not-an-email', password: 'password' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject an empty password', () => {
    // Arrange & Act
    const result = loginSchema.safeParse({ email: 'user@example.com', password: '' })

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('registerSchema', () => {
  const valid = { email: 'user@example.com', password: 'password1', nickname: '모험가' }

  it('should accept a valid registration', () => {
    // Arrange & Act
    const result = registerSchema.safeParse(valid)

    // Assert
    expect(result.success).toBe(true)
  })

  it('should reject a password shorter than eight characters', () => {
    // Arrange & Act
    const result = registerSchema.safeParse({ ...valid, password: 'short7c' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a password longer than the bcrypt limit', () => {
    // Arrange & Act
    const result = registerSchema.safeParse({ ...valid, password: 'a'.repeat(73) })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a nickname shorter than two characters', () => {
    // Arrange & Act
    const result = registerSchema.safeParse({ ...valid, nickname: '가' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a nickname longer than twelve characters', () => {
    // Arrange & Act
    const result = registerSchema.safeParse({ ...valid, nickname: '가'.repeat(13) })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a nickname with punctuation', () => {
    // Arrange & Act
    const result = registerSchema.safeParse({ ...valid, nickname: '모험가!' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should trim surrounding spaces from the nickname', () => {
    // Arrange & Act
    const result = registerSchema.safeParse({ ...valid, nickname: '  모험가  ' })

    // Assert
    expect(result.success && result.data.nickname).toBe('모험가')
  })
})

describe('forgotPasswordSchema', () => {
  it('should accept a valid email', () => {
    // Arrange & Act
    const result = forgotPasswordSchema.safeParse({ email: 'user@example.com' })

    // Assert
    expect(result.success).toBe(true)
  })

  it('should reject a blank email', () => {
    // Arrange & Act
    const result = forgotPasswordSchema.safeParse({ email: '' })

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('sanitizeNextPath', () => {
  it('should keep a same-origin path with its query string', () => {
    // Arrange & Act
    const result = sanitizeNextPath('/community/write?draft=1')

    // Assert
    expect(result).toBe('/community/write?draft=1')
  })

  it('should reject an absolute url', () => {
    // Arrange & Act
    const result = sanitizeNextPath('https://evil.example/steal')

    // Assert
    expect(result).toBe(DEFAULT_NEXT_PATH)
  })

  it('should reject a protocol relative url', () => {
    // Arrange & Act
    const result = sanitizeNextPath('//evil.example')

    // Assert
    expect(result).toBe(DEFAULT_NEXT_PATH)
  })

  it('should reject the backslash variant browsers treat as a host', () => {
    // Arrange & Act
    const result = sanitizeNextPath('/\\evil.example')

    // Assert
    expect(result).toBe(DEFAULT_NEXT_PATH)
  })

  it('should reject a path containing control characters', () => {
    // Arrange & Act
    const result = sanitizeNextPath('/community\n/evil')

    // Assert
    expect(result).toBe(DEFAULT_NEXT_PATH)
  })

  it('should reject a value that is not a string', () => {
    // Arrange & Act & Assert
    expect(sanitizeNextPath(undefined)).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizeNextPath(null)).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizeNextPath(['/a', '/b'])).toBe(DEFAULT_NEXT_PATH)
  })

  it('should reject a bare path without a leading slash', () => {
    // Arrange & Act
    const result = sanitizeNextPath('community')

    // Assert
    expect(result).toBe(DEFAULT_NEXT_PATH)
  })
})
