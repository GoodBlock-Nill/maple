import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

const REDIRECT_PREFIX = 'NEXT_REDIRECT:'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_PREFIX}${path}`)
  },
}))

vi.mock('next/headers', () => ({
  headers: async () => new Headers({ host: 'localhost:3000' }),
}))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { requestPasswordReset, signIn, signOut, signUp } = await import('@/lib/actions/auth-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

function form(values: Record<string, string>): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

beforeEach(() => {
  stub = createSupabaseStub()
})

describe('signIn', () => {
  it('should return field errors when the email is malformed', async () => {
    // Arrange & Act
    const result = await signIn(EMPTY_FORM_STATE, form({ email: 'nope', password: 'password1' }))

    // Assert
    expect(result.fieldErrors?.email).toBeDefined()
    expect(stub.client.auth.signInWithPassword).not.toHaveBeenCalled()
  })

  it('should hide whether the account exists when the credentials are wrong', async () => {
    // Arrange
    stub.client.auth.signInWithPassword.mockResolvedValue({
      data: null,
      error: { message: 'Invalid login credentials' },
    })

    // Act
    const result = await signIn(
      EMPTY_FORM_STATE,
      form({ email: 'user@example.com', password: 'wrong-password' }),
    )

    // Assert — "없는 계정"과 "틀린 비밀번호"를 구분해 알리지 않는다.
    expect(result.formError).toBe('이메일 또는 비밀번호가 올바르지 않습니다.')
  })

  it('should redirect to the sanitized next path on success', async () => {
    // Arrange
    stub.client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })

    // Act
    const promise = signIn(
      EMPTY_FORM_STATE,
      form({ email: 'user@example.com', password: 'password1', next: '/community/write' }),
    )

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/community/write`)
  })

  it('should ignore an off-origin next path', async () => {
    // Arrange
    stub.client.auth.signInWithPassword.mockResolvedValue({ data: {}, error: null })

    // Act
    const promise = signIn(
      EMPTY_FORM_STATE,
      form({ email: 'user@example.com', password: 'password1', next: 'https://evil.example' }),
    )

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/`)
  })
})

describe('signUp', () => {
  const valid = { email: 'user@example.com', password: 'password1', nickname: '모험가' }

  it('should return field errors when the password is too short', async () => {
    // Arrange & Act
    const result = await signUp(EMPTY_FORM_STATE, form({ ...valid, password: 'short' }))

    // Assert
    expect(result.fieldErrors?.password).toBeDefined()
    expect(stub.client.auth.signUp).not.toHaveBeenCalled()
  })

  it('should never forward a role so users cannot promote themselves', async () => {
    // Arrange
    stub.client.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null })

    // Act
    await signUp(EMPTY_FORM_STATE, form({ ...valid, role: 'admin' })).catch(() => undefined)

    // Assert
    const [credentials] = stub.client.auth.signUp.mock.calls[0] as [
      { options: { data: Record<string, unknown> } },
    ]
    expect(credentials.options.data).toEqual({ nickname: '모험가' })
  })

  it('should ask the user to check their inbox when no session is returned', async () => {
    // Arrange — 메일 확인이 켜진 프로젝트
    stub.client.auth.signUp.mockResolvedValue({ data: { session: null }, error: null })

    // Act
    const result = await signUp(EMPTY_FORM_STATE, form(valid))

    // Assert
    expect(result.message).toContain('확인 메일')
  })

  it('should redirect when the project signs the user in immediately', async () => {
    // Arrange
    stub.client.auth.signUp.mockResolvedValue({ data: { session: {} }, error: null })

    // Act
    const promise = signUp(EMPTY_FORM_STATE, form({ ...valid, next: '/community' }))

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/community`)
  })

  it('should return a generic message when sign up fails', async () => {
    // Arrange
    stub.client.auth.signUp.mockResolvedValue({ data: null, error: { message: 'boom' } })

    // Act
    const result = await signUp(EMPTY_FORM_STATE, form(valid))

    // Assert
    expect(result.formError).toBe('가입에 실패했습니다. 잠시 후 다시 시도해 주세요.')
  })
})

describe('requestPasswordReset', () => {
  it('should reject a malformed email before contacting the auth server', async () => {
    // Arrange & Act
    const result = await requestPasswordReset(EMPTY_FORM_STATE, form({ email: 'nope' }))

    // Assert
    expect(result.fieldErrors?.email).toBeDefined()
    expect(stub.client.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('should answer the same way whether or not the account exists', async () => {
    // Arrange
    stub.client.auth.resetPasswordForEmail.mockResolvedValue({
      data: null,
      error: { message: 'User not found' },
    })

    // Act
    const result = await requestPasswordReset(
      EMPTY_FORM_STATE,
      form({ email: 'unknown@example.com' }),
    )

    // Assert
    expect(result.message).toContain('가입 내역이 있으면')
    expect(result.formError).toBeUndefined()
  })
})

describe('signOut', () => {
  it('should clear the session and send the user home', async () => {
    // Arrange & Act
    const promise = signOut()

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/`)
    expect(stub.client.auth.signOut).toHaveBeenCalled()
  })
})
