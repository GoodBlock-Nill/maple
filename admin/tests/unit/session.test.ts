import { describe, expect, it } from 'vitest'

import { buildLastSeenCookie, INACTIVITY_LIMIT_MS, isInactive, LAST_SEEN_COOKIE } from '@/lib/auth/session'

const NOW = 1_800_000_000_000

describe('isInactive', () => {
  it('should return false when the cookie is missing', () => {
    // 로그인 직후 첫 요청에는 쿠키가 없다. 여기서 만료로 보면 로그인 자체가 불가능해진다.
    expect(isInactive(undefined, NOW)).toBe(false)
  })

  it('should return false when the cookie is not a number', () => {
    expect(isInactive('어제', NOW)).toBe(false)
  })

  it('should return false right at the limit', () => {
    expect(isInactive(String(NOW - INACTIVITY_LIMIT_MS), NOW)).toBe(false)
  })

  it('should return true one millisecond past the limit', () => {
    expect(isInactive(String(NOW - INACTIVITY_LIMIT_MS - 1), NOW)).toBe(true)
  })

  it('should return false for a fresh stamp', () => {
    expect(isInactive(String(NOW - 1000), NOW)).toBe(false)
  })
})

describe('buildLastSeenCookie', () => {
  it('should stamp the current time with the inactivity limit as max age', () => {
    const cookie = buildLastSeenCookie(NOW, true)

    expect(cookie.name).toBe(LAST_SEEN_COOKIE)
    expect(cookie.value).toBe(String(NOW))
    expect(cookie.options.maxAge).toBe(INACTIVITY_LIMIT_MS / 1000)
  })

  it('should keep the cookie out of reach of scripts', () => {
    const cookie = buildLastSeenCookie(NOW, true)

    expect(cookie.options.httpOnly).toBe(true)
    expect(cookie.options.sameSite).toBe('lax')
  })

  it('should drop the secure flag on plain http (local development)', () => {
    expect(buildLastSeenCookie(NOW, false).options.secure).toBe(false)
  })
})
