import { describe, expect, it } from 'vitest'

import {
  canCompleteSignup,
  canSendCode,
  canVerifyCode,
  isCodeLocked,
  isEmailLocked,
  looksLikeEmail,
  normalizeOtpInput,
  passwordConfirmIssue,
  passwordIssue,
  RESEND_COOLDOWN_SECONDS,
} from '@/lib/auth/signup-steps'
import { PASSWORD_MISMATCH_MESSAGE, PASSWORD_RULE_MESSAGE } from '@/lib/validation/email-auth'

import type { SignupGateInput } from '@/lib/auth/signup-steps'

/** 기본 상태 — 아무것도 입력하지 않은 첫 화면. */
const BASE: SignupGateInput = {
  email: '',
  code: '',
  password: '',
  passwordConfirm: '',
  step: 'email',
  isPending: false,
  cooldown: 0,
}

const gate = (patch: Partial<SignupGateInput>): SignupGateInput => ({ ...BASE, ...patch })

describe('looksLikeEmail', () => {
  it.each([
    ['tester@glzaworld.co.kr', true],
    ['a@b.co', true],
    ['tester@', false],
    ['tester', false],
    ['a b@c.co', false],
  ])('should judge %s as %s', (value, expected) => {
    // Arrange & Act & Assert
    expect(looksLikeEmail(value)).toBe(expected)
  })
})

describe('normalizeOtpInput', () => {
  it('should keep only digits and cut at six', () => {
    // Arrange & Act & Assert
    expect(normalizeOtpInput('01-23 45 78')).toBe('012345')
    expect(normalizeOtpInput('abc')).toBe('')
  })
})

describe('canSendCode', () => {
  it('should stay closed until the address looks like an email', () => {
    // Arrange & Act & Assert
    expect(canSendCode(gate({ email: 'tester' }))).toBe(false)
    expect(canSendCode(gate({ email: 'tester@glzaworld.co.kr' }))).toBe(true)
  })

  it('should stay closed while the resend cooldown runs', () => {
    // Arrange — 서버(config max_frequency 1분)가 어차피 거절한다.
    const input = gate({ email: 'a@b.co', step: 'code', cooldown: RESEND_COOLDOWN_SECONDS })

    // Act & Assert
    expect(canSendCode(input)).toBe(false)
    expect(canSendCode({ ...input, cooldown: 0 })).toBe(true)
  })

  it('should stay closed after the address is verified', () => {
    // Arrange & Act & Assert — 세션이 이미 그 주소로 발급됐다.
    expect(canSendCode(gate({ email: 'a@b.co', step: 'verified' }))).toBe(false)
  })

  it('should stay closed while a server action is running', () => {
    // Arrange & Act & Assert
    expect(canSendCode(gate({ email: 'a@b.co', isPending: true }))).toBe(false)
  })
})

describe('canVerifyCode', () => {
  it('should open only with six digits in the code step', () => {
    // Arrange & Act & Assert
    expect(canVerifyCode(gate({ step: 'code', code: '01234' }))).toBe(false)
    expect(canVerifyCode(gate({ step: 'code', code: '012345' }))).toBe(true)
  })

  it('should stay closed before a code was sent', () => {
    // Arrange & Act & Assert
    expect(canVerifyCode(gate({ step: 'email', code: '012345' }))).toBe(false)
  })
})

describe('canCompleteSignup', () => {
  const verified = { step: 'verified', code: '012345' } as const

  it('should require a verified address', () => {
    // Arrange
    const passwords = { password: 'maple1234', passwordConfirm: 'maple1234' }

    // Act & Assert
    expect(canCompleteSignup(gate({ ...passwords, step: 'code' }))).toBe(false)
    expect(canCompleteSignup(gate({ ...passwords, ...verified }))).toBe(true)
  })

  it('should require both passwords to match and pass the rule', () => {
    // Arrange & Act & Assert
    expect(
      canCompleteSignup(gate({ ...verified, password: 'maple1234', passwordConfirm: 'maple123' })),
    ).toBe(false)
    expect(
      canCompleteSignup(
        gate({ ...verified, password: 'maplemaple', passwordConfirm: 'maplemaple' }),
      ),
    ).toBe(false)
  })
})

describe('locks', () => {
  it('should lock the email and the code only after verification', () => {
    // Arrange & Act & Assert
    expect(isEmailLocked('email')).toBe(false)
    expect(isEmailLocked('code')).toBe(false)
    expect(isEmailLocked('verified')).toBe(true)
    expect(isCodeLocked('code')).toBe(false)
    expect(isCodeLocked('verified')).toBe(true)
  })
})

describe('password issues', () => {
  it('should say nothing while the field is still empty', () => {
    // Arrange & Act & Assert — 아직 아무것도 하지 않은 사람을 나무라지 않는다.
    expect(passwordIssue('')).toBeNull()
    expect(passwordConfirmIssue('maple1234', '')).toBeNull()
  })

  it('should explain the rule once the value breaks it', () => {
    // Arrange & Act & Assert
    expect(passwordIssue('maple')).toBe(PASSWORD_RULE_MESSAGE)
    expect(passwordIssue('maple1234')).toBeNull()
  })

  it('should flag a mismatch on the confirm field', () => {
    // Arrange & Act & Assert
    expect(passwordConfirmIssue('maple1234', 'maple12345')).toBe(PASSWORD_MISMATCH_MESSAGE)
    expect(passwordConfirmIssue('maple1234', 'maple1234')).toBeNull()
  })
})
