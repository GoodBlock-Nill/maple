import { describe, expect, it } from 'vitest'

import {
  emailSchema,
  isStrongPassword,
  loginSchema,
  LOGIN_NOTICE_MESSAGE,
  newPasswordSchema,
  OTP_LENGTH,
  otpSchema,
  PASSWORD_MISMATCH_MESSAGE,
  PASSWORD_RULE_MESSAGE,
  verifySignupCodeSchema,
} from '@/lib/validation/email-auth'

describe('emailSchema', () => {
  it('should trim and lowercase a pasted address', () => {
    // Arrange
    const input = '  Tester@Example.CO.KR '

    // Act
    const result = emailSchema.safeParse(input)

    // Assert — 저장·조회는 항상 소문자 한 가지 표기만 쓴다.
    expect(result.success).toBe(true)
    expect(result.data).toBe('tester@example.co.kr')
  })

  it('should reject an empty value with a Korean message', () => {
    // Arrange & Act
    const result = emailSchema.safeParse('   ')

    // Assert
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('이메일을 입력해 주세요.')
  })

  it('should reject a malformed address', () => {
    // Arrange & Act
    const result = emailSchema.safeParse('not-an-email')

    // Assert
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('이메일 형식이 올바르지 않습니다.')
  })

  it('should reject an address longer than the RFC limit', () => {
    // Arrange
    const long = `${'a'.repeat(250)}@b.co`

    // Act & Assert
    expect(emailSchema.safeParse(long).success).toBe(false)
  })
})

describe('otpSchema', () => {
  it('should accept six digits', () => {
    // Arrange & Act
    const result = otpSchema.safeParse('012345')

    // Assert
    expect(result.success).toBe(true)
    expect(result.data).toBe('012345')
  })

  it('should strip separators pasted from a mail client', () => {
    // Arrange & Act
    const result = otpSchema.safeParse(' 012-345 ')

    // Assert
    expect(result.success).toBe(true)
    expect(result.data).toBe('012345')
  })

  it.each([['12345'], ['1234567'], ['abcdef']])(
    'should reject %s because it is not six digits',
    (value) => {
      // Arrange & Act
      const result = otpSchema.safeParse(value)

      // Assert
      expect(result.success).toBe(false)
      expect(result.error?.issues[0]?.message).toBe(`인증번호 ${OTP_LENGTH}자리를 입력해 주세요.`)
    },
  )
})

describe('isStrongPassword', () => {
  it.each([
    ['maple1234', true],
    ['한글비번1234', true],
    ['maple12', false], // 7자 — 길이 미달
    ['maplestory', false], // 숫자 없음
  ])('should judge %s as %s', (value, expected) => {
    // Arrange & Act & Assert
    expect(isStrongPassword(value)).toBe(expected)
  })

  it('should require both a letter and a digit', () => {
    // Arrange & Act & Assert
    expect(isStrongPassword('12345678')).toBe(false)
    expect(isStrongPassword('abcdefgh')).toBe(false)
    expect(isStrongPassword('abcd1234')).toBe(true)
  })

  it('should reject anything shorter than eight characters', () => {
    // Arrange & Act & Assert
    expect(isStrongPassword('abc1234')).toBe(false)
  })

  it('should reject a value longer than the bcrypt limit', () => {
    // Arrange & Act & Assert — 73바이트째부터 조용히 잘리므로 미리 막는다.
    expect(isStrongPassword(`${'a'.repeat(72)}1`)).toBe(false)
  })
})

describe('newPasswordSchema', () => {
  it('should point a mismatch at the confirm field', () => {
    // Arrange & Act
    const result = newPasswordSchema.safeParse({
      password: 'maple1234',
      passwordConfirm: 'maple12345',
    })

    // Assert
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['passwordConfirm'])
    expect(result.error?.issues[0]?.message).toBe(PASSWORD_MISMATCH_MESSAGE)
  })

  it('should explain the whole rule at once when the password is weak', () => {
    // Arrange & Act
    const result = newPasswordSchema.safeParse({ password: 'maple', passwordConfirm: 'maple' })

    // Assert
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe(PASSWORD_RULE_MESSAGE)
  })

  it('should accept a matching strong pair', () => {
    // Arrange & Act
    const result = newPasswordSchema.safeParse({
      password: 'maple1234',
      passwordConfirm: 'maple1234',
    })

    // Assert
    expect(result.success).toBe(true)
  })
})

describe('loginSchema', () => {
  it('should require a password without judging its strength', () => {
    // Arrange — 옛 계정의 짧은 비밀번호로도 로그인은 되어야 한다.
    const result = loginSchema.safeParse({ email: 'a@b.co', password: 'old' })

    // Act & Assert
    expect(result.success).toBe(true)
  })

  it('should reject an empty password', () => {
    // Arrange & Act
    const result = loginSchema.safeParse({ email: 'a@b.co', password: '' })

    // Assert
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('비밀번호를 입력해 주세요.')
  })
})

describe('verifySignupCodeSchema', () => {
  it('should normalize both fields together', () => {
    // Arrange & Act
    const result = verifySignupCodeSchema.safeParse({ email: ' A@B.CO ', token: '01 23 45' })

    // Assert
    expect(result.success).toBe(true)
    expect(result.data).toEqual({ email: 'a@b.co', token: '012345' })
  })
})

describe('LOGIN_NOTICE_MESSAGE', () => {
  it('should map the password_updated notice and nothing else', () => {
    // Arrange & Act & Assert
    expect(LOGIN_NOTICE_MESSAGE.password_updated).toBe(
      '비밀번호가 변경되었습니다. 다시 로그인해 주세요.',
    )
    expect(LOGIN_NOTICE_MESSAGE.anything_else).toBeUndefined()
  })
})
