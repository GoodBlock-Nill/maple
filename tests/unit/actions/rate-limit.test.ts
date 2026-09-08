import { describe, expect, it } from 'vitest'

import {
  cooldownMessage,
  remainingCooldown,
  WRITE_COOLDOWN_SECONDS,
} from '@/lib/actions/rate-limit'

const NOW = Date.parse('2026-05-19T10:00:30.000Z')

describe('remainingCooldown', () => {
  it('should allow writing when the user has never written', () => {
    // Arrange & Act
    const result = remainingCooldown(null, NOW)

    // Assert
    expect(result).toBe(0)
  })

  it('should allow writing when the cooldown has fully elapsed', () => {
    // Arrange & Act — 정확히 30초 전
    const result = remainingCooldown('2026-05-19T10:00:00.000Z', NOW)

    // Assert
    expect(result).toBe(0)
  })

  it('should report the remaining seconds when the last write is recent', () => {
    // Arrange & Act — 10초 전
    const result = remainingCooldown('2026-05-19T10:00:20.000Z', NOW)

    // Assert
    expect(result).toBe(20)
  })

  it('should round the remaining seconds up so the message never says zero', () => {
    // Arrange & Act — 29.5초 전 → 0.5초 남음
    const result = remainingCooldown('2026-05-19T10:00:00.500Z', NOW)

    // Assert
    expect(result).toBe(1)
  })

  it('should require the full cooldown when the stored time is in the future', () => {
    // Arrange & Act — DB 시계가 앞선 경우
    const result = remainingCooldown('2026-05-19T10:01:00.000Z', NOW)

    // Assert
    expect(result).toBe(WRITE_COOLDOWN_SECONDS)
  })

  it('should not block writing when the stored time cannot be parsed', () => {
    // Arrange & Act
    const result = remainingCooldown('not-a-date', NOW)

    // Assert
    expect(result).toBe(0)
  })

  it('should honour a custom cooldown window', () => {
    // Arrange & Act
    const result = remainingCooldown('2026-05-19T10:00:20.000Z', NOW, 60)

    // Assert
    expect(result).toBe(50)
  })
})

describe('cooldownMessage', () => {
  it('should mention the remaining seconds in Korean', () => {
    // Arrange & Act
    const result = cooldownMessage(12)

    // Assert
    expect(result).toContain('12초')
  })
})
