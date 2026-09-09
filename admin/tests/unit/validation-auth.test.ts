import { describe, expect, it } from 'vitest'

import {
  ADMIN_PASSWORD_MIN_LENGTH,
  forgotPasswordSchema,
  loginErrorMessage,
  loginSchema,
  NOT_ADMIN_MESSAGE,
  sanitizeNextPath,
  setPasswordSchema,
} from '@/lib/validation/auth'

describe('loginSchema', () => {
  it('should accept a valid pair', () => {
    const result = loginSchema.safeParse({ email: 'nill@good-block.com', password: 'secret' })

    expect(result.success).toBe(true)
  })

  it('should trim surrounding whitespace from the email', () => {
    const result = loginSchema.safeParse({ email: '  nill@good-block.com  ', password: 'x' })

    expect(result.success && result.data.email).toBe('nill@good-block.com')
  })

  it('should reject an empty email with a dedicated message', () => {
    const result = loginSchema.safeParse({ email: '', password: 'x' })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe('이메일을 입력해 주세요.')
  })

  it('should reject a malformed email', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'x' }).success).toBe(false)
  })

  it('should reject an empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false)
  })
})

describe('setPasswordSchema', () => {
  const valid = 'a'.repeat(ADMIN_PASSWORD_MIN_LENGTH)

  it('should accept a matching pair at the minimum length', () => {
    expect(setPasswordSchema.safeParse({ password: valid, passwordConfirm: valid }).success).toBe(
      true,
    )
  })

  it('should reject a password below the minimum length', () => {
    const short = 'a'.repeat(ADMIN_PASSWORD_MIN_LENGTH - 1)

    expect(setPasswordSchema.safeParse({ password: short, passwordConfirm: short }).success).toBe(
      false,
    )
  })

  it('should report a mismatch on the confirmation field', () => {
    const result = setPasswordSchema.safeParse({ password: valid, passwordConfirm: `${valid}!` })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['passwordConfirm'])
  })
})

describe('forgotPasswordSchema', () => {
  it('should accept an email', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'a@b.co' }).success).toBe(true)
  })
})

describe('sanitizeNextPath', () => {
  it('should keep an internal absolute path', () => {
    expect(sanitizeNextPath('/members?page=2')).toBe('/members?page=2')
  })

  it('should reject an absolute URL (open redirect)', () => {
    expect(sanitizeNextPath('https://evil.example')).toBe('/')
  })

  it('should reject a protocol relative URL', () => {
    expect(sanitizeNextPath('//evil.example')).toBe('/')
  })

  it('should reject backslashes that browsers normalise to slashes', () => {
    expect(sanitizeNextPath('/\\evil.example')).toBe('/')
  })

  it('should fall back for empty and non-string input', () => {
    expect(sanitizeNextPath(null)).toBe('/')
    expect(sanitizeNextPath(undefined, '/admins')).toBe('/admins')
  })
})

describe('loginErrorMessage', () => {
  it('should map a known code', () => {
    expect(loginErrorMessage('not_admin')).toContain('관리자 권한')
  })

  /* 관리자 계정은 초대로만 만들어진다(2026-09-09 제품 결정). 문구가 "회원 상세에서
     권한 부여" 로 되돌아가면 받는 사람이 존재하지 않는 절차를 밟게 된다. */
  it('should tell a non-admin to ask for an invite', () => {
    expect(loginErrorMessage('not_admin')).toBe(NOT_ADMIN_MESSAGE)
    expect(NOT_ADMIN_MESSAGE).toBe(
      '관리자 권한이 없는 계정입니다. 슈퍼어드민에게 관리자 초대를 요청해 주세요.',
    )
  })

  it('should return null for an unknown code', () => {
    expect(loginErrorMessage('whatever')).toBeNull()
    expect(loginErrorMessage(null)).toBeNull()
  })
})
