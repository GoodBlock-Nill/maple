import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

/**
 * 마이페이지 비밀번호 변경.
 *
 * 핵심 계약은 하나다 — **현재 비밀번호로 재인증하기 전에는 절대 바꾸지 않는다.**
 * 세션만으로 비밀번호를 바꿀 수 있으면 잠깐 자리를 비운 브라우저로 계정이 넘어간다.
 */

const REDIRECT_PREFIX = 'NEXT_REDIRECT:'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_PREFIX}${path}`)
  },
}))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { changePasswordAction } = await import('@/lib/actions/password-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

const USER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', email: 'user@example.com' }

const VALID = {
  currentPassword: 'old-pass-1',
  password: 'new-pass-1',
  passwordConfirm: 'new-pass-1',
}

function form(values: Record<string, string>): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

beforeEach(() => {
  stub = createSupabaseStub()
  stub.client.auth.getUser.mockResolvedValue({ data: { user: USER }, error: null })
  stub.client.auth.signInWithPassword.mockResolvedValue({ data: { user: USER }, error: null })
  stub.client.auth.updateUser.mockResolvedValue({ data: { user: USER }, error: null })
})

describe('changePasswordAction', () => {
  it('should send an anonymous visitor to the login page', async () => {
    // Arrange
    stub.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const promise = changePasswordAction(EMPTY_FORM_STATE, form(VALID))

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/login?next=${encodeURIComponent('/account')}`,
    )
  })

  it('should refuse an account without an email (간편로그인)', async () => {
    // Arrange
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER.id } }, error: null })

    // Act
    const result = await changePasswordAction(EMPTY_FORM_STATE, form(VALID))

    // Assert
    expect(result.formError).toBe('간편로그인 계정은 비밀번호를 변경할 수 없습니다.')
    expect(stub.client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('should reject a mismatch before re-authenticating', async () => {
    // Arrange & Act
    const result = await changePasswordAction(
      EMPTY_FORM_STATE,
      form({ ...VALID, passwordConfirm: 'other-pass-1' }),
    )

    // Assert
    expect(result.fieldErrors?.passwordConfirm).toBeDefined()
    expect(stub.client.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('should blame the current password field when re-auth fails', async () => {
    // Arrange
    stub.client.auth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { code: 'invalid_credentials', message: 'Invalid login credentials' },
    })

    // Act
    const result = await changePasswordAction(EMPTY_FORM_STATE, form(VALID))

    // Assert
    expect(result.fieldErrors?.currentPassword).toBe('현재 비밀번호가 일치하지 않습니다.')
    expect(stub.client.auth.updateUser).not.toHaveBeenCalled()
  })

  it('should re-authenticate with the account email and then update the password', async () => {
    // Arrange & Act
    const result = await changePasswordAction(EMPTY_FORM_STATE, form(VALID))

    // Assert
    expect(stub.client.auth.signInWithPassword).toHaveBeenCalledWith({
      email: USER.email,
      password: VALID.currentPassword,
    })
    expect(stub.client.auth.updateUser).toHaveBeenCalledWith({ password: VALID.password })
    expect(result.message).toBe('비밀번호를 변경했습니다.')
    expect(typeof result.changedAt).toBe('number')
  })

  it('should translate a Supabase failure into Korean on the password field', async () => {
    // Arrange
    stub.client.auth.updateUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'same_password', message: 'New password should be different' },
    })

    // Act
    const result = await changePasswordAction(EMPTY_FORM_STATE, form(VALID))

    // Assert
    expect(result.fieldErrors?.password).toBe('이전과 다른 비밀번호를 입력해 주세요.')
  })
})
