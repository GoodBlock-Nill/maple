import { describe, expect, it } from 'vitest'

import { cn } from '@/lib/utils/cn'

describe('cn', () => {
  it('should merge class names when given multiple string arguments', () => {
    // Arrange
    const classes = ['text-sm', 'font-bold']

    // Act
    const result = cn(...classes)

    // Assert
    expect(result).toBe('text-sm font-bold')
  })

  it('should override conflicting tailwind classes when later class wins', () => {
    // Arrange
    const base = 'p-2'
    const override = 'p-4'

    // Act
    const result = cn(base, override)

    // Assert
    expect(result).toBe('p-4')
  })

  it('should ignore falsy values when conditional classes are passed', () => {
    // Arrange
    const isActive = false

    // Act
    const result = cn('base', isActive && 'active', undefined, null)

    // Assert
    expect(result).toBe('base')
  })

  it('should return empty string when no arguments are given', () => {
    // Arrange & Act
    const result = cn()

    // Assert
    expect(result).toBe('')
  })
})
