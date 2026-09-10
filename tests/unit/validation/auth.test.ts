import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_NEXT_PATH,
  isOnboardingComplete,
  isSocialProvider,
  mswProfileCodeSchema,
  mswUidSchema,
  onboardingSchema,
  ONBOARDING_PATH,
  parseSocialLoginMode,
  sanitizeNextPath,
  sanitizePostAuthPath,
  SOCIAL_PROVIDERS,
  stubNicknameFor,
  updateAccountSchema,
} from '@/lib/validation/auth'

/** onboardingSchema/updateAccountSchema 테스트가 공유하는 유효한 MSW 필드. */
const VALID_MSW_FIELDS = { mswUid: '20123000000000000', mswProfileCode: '#abcd1' }

/**
 * `FEATURES.mswAccountFields` 는 모듈 로드 시점에 `process.env` 를 한 번만
 * 읽어 굳는 값이다. 플래그별 동작을 검증하려면 env 를 바꾼 뒤 모듈 캐시를
 * 비우고(`vi.resetModules`) 다시 import 해야 한다. 정적 import(위)는 env가
 * 비어 있을 때(기본값, 곧 OFF) 로드된 모듈이라 "기본 OFF" 테스트에 그대로
 * 쓴다.
 */
const FEATURE_ENV_KEY = 'NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS'
const ORIGINAL_FEATURE_ENV = process.env[FEATURE_ENV_KEY]

async function importAuthValidationWithFlag(flagOn: boolean) {
  vi.resetModules()
  process.env[FEATURE_ENV_KEY] = flagOn ? 'true' : 'false'
  return import('@/lib/validation/auth')
}

afterEach(() => {
  if (ORIGINAL_FEATURE_ENV === undefined) {
    delete process.env[FEATURE_ENV_KEY]
  } else {
    process.env[FEATURE_ENV_KEY] = ORIGINAL_FEATURE_ENV
  }
})

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
      ...VALID_MSW_FIELDS,
      termsAgreed: true,
      privacyAgreed: true,
      ageConfirmed: true,
      marketingAgreed: false,
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

describe('onboardingSchema — feature flag OFF (default)', () => {
  const valid = {
    nickname: '모험가',
    ...VALID_MSW_FIELDS,
    termsAgreed: true,
    privacyAgreed: true,
    ageConfirmed: true,
    /* [선택] 마케팅 동의는 boolean 이다 — 체크하지 않아도 통과해야 한다. */
    marketingAgreed: false,
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

  it('should accept a submission missing the MSW UID and profile code', () => {
    // Arrange & Act — 플래그가 꺼져 있으면 입력칸 자체가 없다.
    const missingUid = onboardingSchema.safeParse({ ...valid, mswUid: '' })
    const missingCode = onboardingSchema.safeParse({ ...valid, mswProfileCode: '' })
    const missingBoth = onboardingSchema.safeParse({
      nickname: valid.nickname,
      termsAgreed: true,
      privacyAgreed: true,
      ageConfirmed: true,
      marketingAgreed: false,
    })

    // Assert
    expect(missingUid.success).toBe(true)
    expect(missingCode.success).toBe(true)
    expect(missingBoth.success).toBe(true)
  })
})

describe('onboardingSchema — feature flag ON', () => {
  const valid = {
    nickname: '모험가',
    ...VALID_MSW_FIELDS,
    termsAgreed: true,
    privacyAgreed: true,
    ageConfirmed: true,
    /* [선택] 마케팅 동의는 boolean 이다 — 체크하지 않아도 통과해야 한다. */
    marketingAgreed: false,
  }

  it('should require both the MSW UID and profile code', async () => {
    // Arrange
    const { onboardingSchema: onboardingSchemaOn } = await importAuthValidationWithFlag(true)

    // Act
    const missingUid = onboardingSchemaOn.safeParse({ ...valid, mswUid: '' })
    const missingCode = onboardingSchemaOn.safeParse({ ...valid, mswProfileCode: '' })

    // Assert
    expect(missingUid.success).toBe(false)
    expect(missingCode.success).toBe(false)
  })

  it('should accept a complete submission including the MSW account', async () => {
    // Arrange
    const { onboardingSchema: onboardingSchemaOn } = await importAuthValidationWithFlag(true)

    // Act
    const result = onboardingSchemaOn.safeParse(valid)

    // Assert
    expect(result.success).toBe(true)
  })
})

describe('mswUidSchema', () => {
  it('should accept a 10~20 digit UID', () => {
    // Arrange & Act & Assert
    expect(mswUidSchema.safeParse('20123000000000000').success).toBe(true)
    expect(mswUidSchema.safeParse('1234567890').success).toBe(true)
  })

  it('should trim surrounding spaces', () => {
    // Arrange & Act
    const result = mswUidSchema.safeParse('  1234567890  ')

    // Assert
    expect(result.success && result.data).toBe('1234567890')
  })

  it('should reject a UID shorter than ten digits', () => {
    // Arrange & Act & Assert
    expect(mswUidSchema.safeParse('123456789').success).toBe(false)
  })

  it('should reject a UID longer than twenty digits', () => {
    // Arrange & Act & Assert
    expect(mswUidSchema.safeParse('1'.repeat(21)).success).toBe(false)
  })

  it('should reject non-digit characters', () => {
    // Arrange & Act & Assert — 클라이언트가 보여 주는 값은 숫자뿐이다.
    expect(mswUidSchema.safeParse('2012300000000000a').success).toBe(false)
    expect(mswUidSchema.safeParse('2012-3000-0000').success).toBe(false)
  })
})

describe('mswProfileCodeSchema', () => {
  it('should accept a well-formed code as-is', () => {
    // Arrange & Act
    const result = mswProfileCodeSchema.safeParse('#abcd1')

    // Assert
    expect(result.success && result.data).toBe('#abcd1')
  })

  it('should add the leading "#" when missing', () => {
    // Arrange & Act
    const result = mswProfileCodeSchema.safeParse('abcd1')

    // Assert
    expect(result.success && result.data).toBe('#abcd1')
  })

  it('should lowercase mixed-case input', () => {
    // Arrange & Act
    const result = mswProfileCodeSchema.safeParse('#ABCD1')

    // Assert
    expect(result.success && result.data).toBe('#abcd1')
  })

  it('should trim surrounding spaces before normalizing', () => {
    // Arrange & Act
    const result = mswProfileCodeSchema.safeParse('  #abcd1  ')

    // Assert
    expect(result.success && result.data).toBe('#abcd1')
  })

  it('should reject a code shorter than four characters after the "#"', () => {
    // Arrange & Act & Assert
    expect(mswProfileCodeSchema.safeParse('#abc').success).toBe(false)
  })

  it('should reject a code longer than ten characters after the "#"', () => {
    // Arrange & Act & Assert
    expect(mswProfileCodeSchema.safeParse(`#${'a'.repeat(11)}`).success).toBe(false)
  })

  it('should reject punctuation other than the leading "#"', () => {
    // Arrange & Act & Assert
    expect(mswProfileCodeSchema.safeParse('#ab-d1').success).toBe(false)
    expect(mswProfileCodeSchema.safeParse('#ab cd').success).toBe(false)
  })
})

describe('updateAccountSchema — feature flag OFF (default)', () => {
  const valid = { nickname: '모험가', ...VALID_MSW_FIELDS }

  it('should accept a complete submission', () => {
    // Arrange & Act & Assert
    expect(updateAccountSchema.safeParse(valid).success).toBe(true)
  })

  it('should accept a submission missing the MSW UID and profile code', () => {
    // Arrange & Act
    const missingUid = updateAccountSchema.safeParse({ ...valid, mswUid: '' })
    const missingCode = updateAccountSchema.safeParse({ ...valid, mswProfileCode: '' })
    const missingBoth = updateAccountSchema.safeParse({ nickname: valid.nickname })

    // Assert
    expect(missingUid.success).toBe(true)
    expect(missingCode.success).toBe(true)
    expect(missingBoth.success).toBe(true)
  })
})

describe('updateAccountSchema — feature flag ON', () => {
  const valid = { nickname: '모험가', ...VALID_MSW_FIELDS }

  it('should require the MSW UID and profile code alongside the nickname', async () => {
    // Arrange
    const { updateAccountSchema: updateAccountSchemaOn } = await importAuthValidationWithFlag(true)

    // Act
    const missingUid = updateAccountSchemaOn.safeParse({ ...valid, mswUid: '' })
    const missingCode = updateAccountSchemaOn.safeParse({ ...valid, mswProfileCode: '' })

    // Assert
    expect(missingUid.success).toBe(false)
    expect(missingCode.success).toBe(false)
  })
})

describe('isOnboardingComplete — feature flag OFF (default)', () => {
  const complete = {
    nickname: '모험가',
    terms_agreed_at: '2026-09-08T00:00:00.000Z',
    privacy_agreed_at: '2026-09-08T00:00:00.000Z',
    age_confirmed_at: '2026-09-08T00:00:00.000Z',
    msw_uid: null,
    msw_profile_code: null,
  }

  it('should accept a profile with a nickname and all consents, even without the MSW account', () => {
    // Arrange & Act & Assert — 플래그가 꺼져 있으면 UID·프로필 코드는 보지 않는다.
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

describe('isOnboardingComplete — feature flag ON', () => {
  const complete = {
    nickname: '모험가',
    terms_agreed_at: '2026-09-08T00:00:00.000Z',
    privacy_agreed_at: '2026-09-08T00:00:00.000Z',
    age_confirmed_at: '2026-09-08T00:00:00.000Z',
    msw_uid: '20123000000000000',
    msw_profile_code: '#abcd1',
  }

  it('should accept a profile with a nickname, all consents, and the MSW account', async () => {
    // Arrange
    const { isOnboardingComplete: isOnboardingCompleteOn } =
      await importAuthValidationWithFlag(true)

    // Act & Assert
    expect(isOnboardingCompleteOn(complete)).toBe(true)
  })

  it('should reject a profile missing the MSW UID or profile code', async () => {
    // Arrange — 기존 스텁 계정도 이 값이 없으므로 한 번 더 온보딩으로 보낸다.
    const { isOnboardingComplete: isOnboardingCompleteOn } =
      await importAuthValidationWithFlag(true)

    // Act & Assert
    expect(isOnboardingCompleteOn({ ...complete, msw_uid: null })).toBe(false)
    expect(isOnboardingCompleteOn({ ...complete, msw_profile_code: null })).toBe(false)
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
