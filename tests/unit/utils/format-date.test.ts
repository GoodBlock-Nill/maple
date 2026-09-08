import { describe, expect, it } from 'vitest'

import { formatDateIso, formatDateLong, formatDateShort } from '@/lib/utils/format-date'

describe('formatDateShort', () => {
  it('should return MM-DD when given an ISO string with Asia/Seoul offset', () => {
    // Arrange
    const iso = '2026-09-04T10:15:00+09:00'

    // Act
    const result = formatDateShort(iso)

    // Assert
    expect(result).toBe('09-04')
  })

  it('should convert to Asia/Seoul timezone when UTC time crosses midnight', () => {
    // Arrange
    // 2026-09-03T16:00:00.000Z === 2026-09-04T01:00:00+09:00 in Seoul
    const iso = '2026-09-03T16:00:00.000Z'

    // Act
    const result = formatDateShort(iso)

    // Assert
    expect(result).toBe('09-04')
  })

  it('should pad single digit month and day with zero when formatting', () => {
    // Arrange
    const iso = '2026-01-05T02:05:00+09:00'

    // Act
    const result = formatDateShort(iso)

    // Assert
    expect(result).toBe('01-05')
  })
})

describe('formatDateLong', () => {
  it('should return YYYY.MM.DD HH:mm when given an ISO string with Asia/Seoul offset', () => {
    // Arrange
    const iso = '2026-09-04T10:15:00+09:00'

    // Act
    const result = formatDateLong(iso)

    // Assert
    expect(result).toBe('2026.09.04 10:15')
  })

  it('should convert to Asia/Seoul timezone when UTC time crosses midnight', () => {
    // Arrange
    const iso = '2026-09-03T16:00:00.000Z'

    // Act
    const result = formatDateLong(iso)

    // Assert
    expect(result).toBe('2026.09.04 01:00')
  })

  it('should pad single digit hour and minute with zero when formatting', () => {
    // Arrange
    const iso = '2026-01-05T02:05:00+09:00'

    // Act
    const result = formatDateLong(iso)

    // Assert
    expect(result).toBe('2026.01.05 02:05')
  })
})

describe('formatDateIso', () => {
  it('should format the date as YYYY-MM-DD when a UTC timestamp is given', () => {
    // Arrange
    const iso = '2026-05-19T10:00:00.000Z'

    // Act
    const result = formatDateIso(iso)

    // Assert
    expect(result).toBe('2026-05-19')
  })

  it('should roll over to the next day when the KST offset crosses midnight', () => {
    // Arrange
    const iso = '2026-05-19T15:30:00.000Z'

    // Act
    const result = formatDateIso(iso)

    // Assert
    expect(result).toBe('2026-05-20')
  })
})
