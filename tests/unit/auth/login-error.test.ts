import { describe, expect, it } from 'vitest'

import { LOGIN_FAILURE_MESSAGE, loginErrorMessage } from '@/lib/auth/login-error'

describe('loginErrorMessage', () => {
  it('should render nothing when there is no error parameter', () => {
    // Arrange & Act & Assert — 정상 진입에서는 오류 행 자체가 없어야 한다.
    expect(loginErrorMessage(undefined)).toBeUndefined()
    expect(loginErrorMessage(null)).toBeUndefined()
    expect(loginErrorMessage('')).toBeUndefined()
    expect(loginErrorMessage('   ')).toBeUndefined()
  })

  it('should fall back to the design copy for the generic OAuth failure', () => {
    // Arrange & Act
    const message = loginErrorMessage('oauth_failed')

    // Assert — 시안(auth-v2 §PC 오류 행)의 문구 그대로다.
    expect(message).toBe('로그인에 실패했어요. 잠시 후 다시 시도해주세요')
    expect(message).toBe(LOGIN_FAILURE_MESSAGE)
  })

  it('should keep the specific messages that tell the user what to do next', () => {
    // Arrange & Act & Assert
    expect(loginErrorMessage('provider_not_configured')).toBe('아직 준비 중인 로그인 방식입니다.')
    expect(loginErrorMessage('link_expired')).toBe(
      '메일 링크가 만료되었습니다. 다시 요청해 주세요.',
    )
  })

  it('should never echo an unknown error code back to the screen', () => {
    // Arrange & Act
    const message = loginErrorMessage('<script>alert(1)</script>')

    // Assert
    expect(message).toBe(LOGIN_FAILURE_MESSAGE)
  })
})
