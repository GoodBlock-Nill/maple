import { describe, expect, it } from 'vitest'

import { AUTH_MESSAGE, toAuthErrorMessage } from '@/lib/auth/auth-error-messages'

describe('toAuthErrorMessage', () => {
  it.each([
    ['invalid_credentials', AUTH_MESSAGE.invalidCredentials],
    ['email_not_confirmed', AUTH_MESSAGE.emailNotConfirmed],
    ['over_email_send_rate_limit', AUTH_MESSAGE.rateLimited],
    ['otp_expired', AUTH_MESSAGE.otpInvalid],
    ['same_password', AUTH_MESSAGE.samePassword],
    ['weak_password', AUTH_MESSAGE.weakPassword],
    ['email_exists', AUTH_MESSAGE.emailTaken],
    ['email_address_invalid', AUTH_MESSAGE.emailUnusable],
  ])('should translate the %s code', (code, expected) => {
    // Arrange & Act & Assert
    expect(toAuthErrorMessage({ code, message: 'raw english text' })).toBe(expected)
  })

  it('should treat any 429 as a rate limit even without a code', () => {
    // Arrange — 게이트웨이가 만든 응답에는 code 가 없다.
    const error = { status: 429, message: 'Too Many Requests' }

    // Act & Assert
    expect(toAuthErrorMessage(error)).toBe(AUTH_MESSAGE.rateLimited)
  })

  it('should fall back to the raw message only as a needle, never as output', () => {
    // Arrange
    const error = { message: 'Token has expired or is invalid' }

    // Act
    const result = toAuthErrorMessage(error)

    // Assert — 원문이 그대로 새어 나가지 않는다.
    expect(result).toBe(AUTH_MESSAGE.otpInvalid)
    expect(result).not.toContain('Token')
  })

  it('should use the caller fallback for an unknown error', () => {
    // Arrange & Act & Assert
    expect(toAuthErrorMessage({ code: 'something_new' }, '기본 문구')).toBe('기본 문구')
    expect(toAuthErrorMessage(null)).toBe(AUTH_MESSAGE.generic)
  })
})
