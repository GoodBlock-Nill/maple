import { describe, expect, it } from 'vitest'

import { formatDate, formatDateTime, formatRelativeDay } from '@/lib/utils/format-date'

/* 서버는 UTC, 운영자는 KST 로 본다. 아래 값들은 모두 "UTC 로 저장된 시각이
   한국시간으로 어떻게 보여야 하는가"를 못 박는다. */

describe('formatDate', () => {
  it('should shift a UTC instant into the Korean calendar day', () => {
    // 2026-09-08T15:30Z = 2026-09-09 00:30 KST → 날짜가 하루 넘어간다.
    expect(formatDate('2026-09-08T15:30:00Z')).toBe('2026-09-09')
  })

  it('should keep the same day before the KST boundary', () => {
    expect(formatDate('2026-09-08T14:59:00Z')).toBe('2026-09-08')
  })

  it('should render a dash for missing values', () => {
    expect(formatDate(null)).toBe('-')
    expect(formatDate(undefined)).toBe('-')
  })
})

describe('formatDateTime', () => {
  it('should pad hours and minutes', () => {
    expect(formatDateTime('2026-09-08T00:04:00Z')).toBe('2026-09-08 09:04')
  })

  it('should render a dash for an unparsable value', () => {
    expect(formatDateTime('오늘')).toBe('-')
  })
})

describe('formatRelativeDay', () => {
  const now = new Date('2026-09-08T05:00:00Z') // 2026-09-08 14:00 KST

  it('should show only the time for the same Korean day', () => {
    expect(formatRelativeDay('2026-09-08T01:20:00Z', now)).toBe('10:20')
  })

  it('should show the date for another day', () => {
    expect(formatRelativeDay('2026-09-06T01:20:00Z', now)).toBe('2026-09-06')
  })
})
