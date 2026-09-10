import { describe, expect, it } from 'vitest'

import {
  AVATAR_MAX_BYTES,
  changePasswordSchema,
  couponCodeSchema,
  MARKETING_COLUMN,
  nameSchema,
  redeemCouponSchema,
  SAME_PASSWORD_MESSAGE,
  updateProfileSchema,
  validateAvatarFile,
} from '@/lib/validation/account'

/**
 * 마이페이지 검증 규칙.
 *
 * 서버 액션은 UI 없이도 호출되므로(직접 POST) 여기 규칙이 곧 신뢰 경계다.
 * 화면 문구가 아니라 "무엇을 통과시키고 무엇을 막는가"를 본다.
 */

describe('nameSchema', () => {
  it('should accept an empty name because 이름 is optional', () => {
    // Arrange & Act
    const result = nameSchema.safeParse('   ')

    // Assert
    expect(result.success).toBe(true)
    expect(result.data).toBe('')
  })

  it('should reject a name longer than the DB constraint', () => {
    // Arrange & Act — profiles_name_length 는 20자다.
    const result = nameSchema.safeParse('가'.repeat(21))

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('updateProfileSchema', () => {
  it('should trim the name and keep the nickname rules', () => {
    // Arrange & Act
    const result = updateProfileSchema.safeParse({ name: '  홍길동  ', nickname: '모험가' })

    // Assert
    expect(result.success).toBe(true)
    expect(result.data?.name).toBe('홍길동')
  })

  it('should reject a nickname with a space (auth 규칙 그대로)', () => {
    // Arrange & Act
    const result = updateProfileSchema.safeParse({ name: '', nickname: '모 험가' })

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('validateAvatarFile', () => {
  it('should accept a PNG within the bucket limit', () => {
    // Arrange & Act
    const result = validateAvatarFile({ type: 'image/png', size: 1024 })

    // Assert
    expect(result).toEqual({ ok: true, mime: 'image/png' })
  })

  it('should refuse a GIF because the bucket does not allow it', () => {
    // Arrange & Act
    const result = validateAvatarFile({ type: 'image/gif', size: 1024 })

    // Assert
    expect(result.ok).toBe(false)
  })

  it('should refuse a file over 10MB with a Korean message', () => {
    // Arrange & Act
    const result = validateAvatarFile({ type: 'image/jpeg', size: AVATAR_MAX_BYTES + 1 })

    // Assert
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.message).toContain('10MB')
  })

  it('should refuse an empty file', () => {
    // Arrange & Act
    const result = validateAvatarFile({ type: 'image/png', size: 0 })

    // Assert
    expect(result.ok).toBe(false)
  })
})

describe('changePasswordSchema', () => {
  const valid = {
    currentPassword: 'old-pass-1',
    password: 'new-pass-1',
    passwordConfirm: 'new-pass-1',
  }

  it('should accept a strong new password confirmed twice', () => {
    // Arrange & Act
    const result = changePasswordSchema.safeParse(valid)

    // Assert
    expect(result.success).toBe(true)
  })

  it('should point a mismatch at the confirm field', () => {
    // Arrange & Act
    const result = changePasswordSchema.safeParse({ ...valid, passwordConfirm: 'other-pass-1' })

    // Assert
    expect(result.error?.issues[0]?.path).toEqual(['passwordConfirm'])
  })

  it('should refuse reusing the current password', () => {
    // Arrange & Act
    const result = changePasswordSchema.safeParse({
      currentPassword: 'same-pass-1',
      password: 'same-pass-1',
      passwordConfirm: 'same-pass-1',
    })

    // Assert
    expect(result.success).toBe(false)
    expect(result.error?.issues.some((issue) => issue.message === SAME_PASSWORD_MESSAGE)).toBe(true)
  })

  it('should require an alphanumeric password of at least 8 characters', () => {
    // Arrange & Act
    const result = changePasswordSchema.safeParse({
      ...valid,
      password: 'short1',
      passwordConfirm: 'short1',
    })

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('couponCodeSchema', () => {
  it('should normalize case and spaces like code_normalized does', () => {
    // Arrange & Act
    const result = couponCodeSchema.safeParse(' glza-test-0001 ')

    // Assert
    expect(result.data).toBe('GLZA-TEST-0001')
  })

  it('should keep hyphens so two different codes never collapse into one', () => {
    // Arrange & Act
    const result = couponCodeSchema.safeParse('GLZAT-EST0-001')

    // Assert
    expect(result.data).toBe('GLZAT-EST0-001')
  })

  it('should reject a code shorter than the DB shape allows', () => {
    // Arrange & Act
    const result = couponCodeSchema.safeParse('ABC')

    // Assert
    expect(result.success).toBe(false)
  })

  it('should reject a code with characters outside [A-Z0-9-]', () => {
    // Arrange & Act
    const result = couponCodeSchema.safeParse('GLZA_TEST')

    // Assert
    expect(result.success).toBe(false)
  })
})

describe('redeemCouponSchema', () => {
  it('should always require the MSW uid and profile code', () => {
    // Arrange & Act — 기능 플래그와 무관하게 보상 지급에 반드시 필요하다.
    const result = redeemCouponSchema.safeParse({ code: 'GLZA-TEST-0001' })

    // Assert
    expect(result.success).toBe(false)
  })

  it('should normalize the profile code (lowercase, leading "#")', () => {
    // Arrange & Act
    const result = redeemCouponSchema.safeParse({
      code: 'GLZA-TEST-0001',
      mswUid: '20123000000000000',
      mswProfileCode: 'ABCD1',
    })

    // Assert
    expect(result.data?.mswProfileCode).toBe('#abcd1')
  })
})

describe('MARKETING_COLUMN', () => {
  it('should map each channel to its own opt-out column', () => {
    // Arrange & Act & Assert — 화면과 DB 사이의 유일한 대응표다.
    expect(MARKETING_COLUMN.sms).toBe('marketing_sms_opt_out')
    expect(MARKETING_COLUMN.email).toBe('marketing_email_opt_out')
  })
})
