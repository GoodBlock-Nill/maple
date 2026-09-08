import { describe, expect, it } from 'vitest'

import {
  DEFAULT_NEXT_PATH,
  isOnboardingComplete,
  isSocialProvider,
  onboardingSchema,
  ONBOARDING_PATH,
  parseSocialLoginMode,
  sanitizeNextPath,
  sanitizePostAuthPath,
  SOCIAL_PROVIDERS,
  stubNicknameFor,
} from '@/lib/validation/auth'

describe('SOCIAL_PROVIDERS', () => {
  it('should expose exactly the three 간편로그인 providers', () => {
    // Arrange & Act & Assert
    expect(SOCIAL_PROVIDERS).toEqual(['google', 'kakao', 'naver'])
  })
})

describe('isSocialProvider', () => {
  it('should accept a supported provider', () => {
    // Arrange & Act & Assert
    expect(isSocialProvider('kakao')).toBe(true)
  })

  it('should reject anything else', () => {
    // Arrange & Act & Assert — 직접 POST 로 임의 문자열이 올 수 있다.
    expect(isSocialProvider('apple')).toBe(false)
    expect(isSocialProvider('')).toBe(false)
    expect(isSocialProvider(undefined)).toBe(false)
    expect(isSocialProvider(['google'])).toBe(false)
  })
})

describe('stubNicknameFor', () => {
  it('should produce a nickname that passes the nickname rules', () => {
    // Arrange
    const nickname = stubNicknameFor('naver')

    // Act
    const result = onboardingSchema.safeParse({
      nickname,
      termsAgreed: true,
      privacyAgreed: true,
      ageConfirmed: true,
    })

    // Assert — 공백이 섞이면 온보딩 폼이 곧바로 반려한다.
    expect(nickname).toBe('네이버테스터')
    expect(result.success).toBe(true)
  })
})

describe('parseSocialLoginMode', () => {
  it('should default to stub when unset', () => {
    // Arrange & Act & Assert
    expect(parseSocialLoginMode(undefined)).toBe('stub')
    expect(parseSocialLoginMode('')).toBe('stub')
  })

  it('should read a known mode case-insensitively', () => {
    // Arrange & Act & Assert
    expect(parseSocialLoginMode(' OAuth ')).toBe('oauth')
  })

  it('should fall back to stub for an unknown value', () => {
    // Arrange & Act & Assert
    expect(parseSocialLoginMode('production')).toBe('stub')
  })
})

describe('onboardingSchema', () => {
  const valid = {
    nickname: '모험가',
    termsAgreed: true,
    privacyAgreed: true,
    ageConfirmed: true,
  }

  it('should accept a complete submission', () => {
    // Arrange & Act
    const result = onboardingSchema.safeParse(valid)

    // Assert
    expect(result.success).toBe(true)
  })

  it('should trim surrounding spaces from the nickname', () => {
    // Arrange & Act
    const result = onboardingSchema.safeParse({ ...valid, nickname: '  모험가  ' })

    // Assert
    expect(result.success && result.data.nickname).toBe('모험가')
  })

  it('should reject a nickname shorter than two characters', () => {
    // Arrange & Act
    const result = onboardingSchema.safeParse({ ...valid, nickname: '가' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a nickname longer than twelve characters', () => {
    // Arrange & Act
    const result = onboardingSchema.safeParse({ ...valid, nickname: '가'.repeat(13) })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a nickname with punctuation or spaces', () => {
    // Arrange & Act & Assert
    expect(onboardingSchema.safeParse({ ...valid, nickname: '모험가!' }).success).toBe(false)
    expect(onboardingSchema.safeParse({ ...valid, nickname: '구글 테스터' }).success).toBe(false)
  })

  it('should require every consent checkbox', () => {
    // Arrange & Act
    const terms = onboardingSchema.safeParse({ ...valid, termsAgreed: false })
    const privacy = onboardingSchema.safeParse({ ...valid, privacyAgreed: false })
    const age = onboardingSchema.safeParse({ ...valid, ageConfirmed: false })

    // Assert — 만 14세 확인은 개인정보처리방침 제11조 때문에 선택이 아니다.
    expect(terms.success).toBe(false)
    expect(privacy.success).toBe(false)
    expect(age.success).toBe(false)
  })
})

describe('isOnboardingComplete', () => {
  const complete = {
    nickname: '모험가',
    terms_agreed_at: '2026-09-08T00:00:00.000Z',
    privacy_agreed_at: '2026-09-08T00:00:00.000Z',
    age_confirmed_at: '2026-09-08T00:00:00.000Z',
  }

  it('should accept a profile with a nickname and all three consents', () => {
    // Arrange & Act & Assert
    expect(isOnboardingComplete(complete)).toBe(true)
  })

  it('should treat a missing profile as incomplete', () => {
    // Arrange & Act & Assert — 트리거 실패 등으로 프로필이 없을 수 있다.
    expect(isOnboardingComplete(null)).toBe(false)
    expect(isOnboardingComplete(undefined)).toBe(false)
  })

  it('should reject a profile missing any single consent', () => {
    // Arrange & Act & Assert
    expect(isOnboardingComplete({ ...complete, terms_agreed_at: null })).toBe(false)
    expect(isOnboardingComplete({ ...complete, privacy_agreed_at: null })).toBe(false)
    expect(isOnboardingComplete({ ...complete, age_confirmed_at: null })).toBe(false)
  })

  it('should reject a blank nickname', () => {
    // Arrange & Act & Assert
    expect(isOnboardingComplete({ ...complete, nickname: '   ' })).toBe(false)
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

describe('sanitizePostAuthPath', () => {
  it('should keep an ordinary destination', () => {
    // Arrange & Act
    const result = sanitizePostAuthPath('/community/write')

    // Assert
    expect(result).toBe('/community/write')
  })

  it('should never send the user back to onboarding', () => {
    // Arrange & Act & Assert — 그대로 두면 온보딩이 자기 자신으로 무한 순환한다.
    expect(sanitizePostAuthPath(ONBOARDING_PATH)).toBe(DEFAULT_NEXT_PATH)
    expect(sanitizePostAuthPath(`${ONBOARDING_PATH}?next=%2F`)).toBe(DEFAULT_NEXT_PATH)
  })

  it('should still reject an off-origin destination', () => {
    // Arrange & Act
    const result = sanitizePostAuthPath('https://evil.example')

    // Assert
    expect(result).toBe(DEFAULT_NEXT_PATH)
  })
})
