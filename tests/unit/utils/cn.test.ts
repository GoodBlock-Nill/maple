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

  /**
   * tailwind-merge 는 모르는 `text-*` 를 전부 글자색으로 분류한다.
   * `extend.theme.text` 에 반응형 서체 유틸리티를 등록하지 않으면 아래 조합에서
   * 크기 클래스가 색과 충돌한 것으로 판정돼 조용히 사라진다.
   */
  it.each([
    'text-ui',
    'text-ui-sm',
    'text-prose',
    'text-input',
    'text-input-sm',
    'text-card-title',
    'text-card-sub',
    'text-title-lg',
    'text-title-md',
    'text-label-lg',
    'text-body-lg',
  ])('should keep %s when a text color is merged after it', (size) => {
    // Arrange & Act
    const result = cn(size, 'text-white')

    // Assert
    expect(result).toBe(`${size} text-white`)
  })

  it('should drop the earlier size when two responsive sizes collide', () => {
    // Arrange & Act
    const result = cn('text-ui', 'text-prose')

    // Assert
    expect(result).toBe('text-prose')
  })

  it('should let an arbitrary size override a responsive size utility', () => {
    // Arrange & Act
    const result = cn('text-ui', 'text-[13px]')

    // Assert
    expect(result).toBe('text-[13px]')
  })
})
