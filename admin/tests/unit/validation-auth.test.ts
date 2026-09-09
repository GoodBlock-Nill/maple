import { describe, expect, it } from 'vitest'

import {
  ADMIN_PASSWORD_MIN_LENGTH,
  forgotPasswordSchema,
  isNativeSocialProvider,
  isPasswordLoginEnabled,
  isSocialProvider,
  loginErrorMessage,
  loginSchema,
  parseSocialLoginMode,
  sanitizeNextPath,
  setPasswordSchema,
  SOCIAL_PROVIDER_LABEL,
  SOCIAL_PROVIDERS,
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

  /* 초대 흐름은 2026-09-09 제품 결정으로 사라졌다. 문구가 "담당자에게 초대를
     요청" 으로 되돌아가면 받는 사람이 존재하지 않는 절차를 밟게 된다. */
  it('should tell a non-admin to ask for a promotion on the member page', () => {
    expect(loginErrorMessage('not_admin')).toBe(
      '관리자 권한이 없는 계정입니다. 관리자에게 회원 상세에서 권한 부여를 요청해 주세요.',
    )
  })

  it('should return null for an unknown code', () => {
    expect(loginErrorMessage('whatever')).toBeNull()
    expect(loginErrorMessage(null)).toBeNull()
  })
})

describe('간편로그인 제공자', () => {
  it('should keep the same three providers as the client site', () => {
    expect(SOCIAL_PROVIDERS).toEqual(['google', 'kakao', 'naver'])
    expect(SOCIAL_PROVIDER_LABEL.kakao).toBe('카카오')
  })

  it('should narrow only known provider values', () => {
    expect(isSocialProvider('google')).toBe(true)
    expect(isSocialProvider('facebook')).toBe(false)
    expect(isSocialProvider(null)).toBe(false)
  })

  // 네이버는 Supabase 기본 제공자 목록에 없어 별도 연동이 끝나야 열린다.
  it('should exclude naver from supabase native providers', () => {
    expect(isNativeSocialProvider('google')).toBe(true)
    expect(isNativeSocialProvider('kakao')).toBe(true)
    expect(isNativeSocialProvider('naver')).toBe(false)
  })
})

describe('parseSocialLoginMode', () => {
  it('should accept oauth in any casing', () => {
    expect(parseSocialLoginMode('oauth')).toBe('oauth')
    expect(parseSocialLoginMode(' OAuth ')).toBe('oauth')
  })

  it('should fall back to stub for missing or unknown values', () => {
    expect(parseSocialLoginMode(undefined)).toBe('stub')
    expect(parseSocialLoginMode('')).toBe('stub')
    expect(parseSocialLoginMode('real')).toBe('stub')
  })
})

describe('isPasswordLoginEnabled', () => {
  it('should stay on by default so the bootstrap admin can get in', () => {
    expect(isPasswordLoginEnabled(undefined)).toBe(true)
    expect(isPasswordLoginEnabled('')).toBe(true)
    expect(isPasswordLoginEnabled('enabled')).toBe(true)
  })

  it('should only close on the exact disabled switch', () => {
    expect(isPasswordLoginEnabled('disabled')).toBe(false)
    expect(isPasswordLoginEnabled(' DISABLED ')).toBe(false)
  })
})
