import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

const REDIRECT_PREFIX = 'NEXT_REDIRECT:'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_PREFIX}${path}`)
  },
}))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { restoreAccountAction, withdrawAccountAction } =
  await import('@/lib/actions/account-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const DELETED_AT = '2026-09-09T00:00:00.000Z'

function form(values: Record<string, string> = {}): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

function signedIn(results: Parameters<typeof createSupabaseStub>[0] = []): SupabaseStub {
  const next = createSupabaseStub(results)
  next.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

  return next
}

beforeEach(() => {
  stub = createSupabaseStub()
})

describe('withdrawAccountAction', () => {
  it('should send an anonymous visitor to the login page', async () => {
    // Arrange & Act
    const promise = withdrawAccountAction(EMPTY_FORM_STATE, form())

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/login?next=${encodeURIComponent('/account')}`,
    )
    expect(stub.updates).toHaveLength(0)
  })

  it('should stamp deleted_at, sign out, and land on the home notice', async () => {
    // Arrange — 갱신된 행이 되읽힌다.
    stub = signedIn([{ data: { deleted_at: DELETED_AT }, error: null }])

    // Act
    const promise = withdrawAccountAction(EMPTY_FORM_STATE, form())

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/?notice=withdrawn`)
    expect(stub.tables).toEqual(['profiles'])
    expect(stub.updates).toHaveLength(1)
    expect((stub.updates[0] as { deleted_at: string }).deleted_at).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    expect(stub.client.auth.signOut).toHaveBeenCalledTimes(1)
  })

  it('should report a failure and keep the session when the update is rejected', async () => {
    // Arrange
    stub = signedIn([{ data: null, error: { code: '42501', message: 'rls' } }])

    // Act
    const result = await withdrawAccountAction(EMPTY_FORM_STATE, form())

    // Assert — 원문(정책명)은 새지 않고, 다음 행동이 담긴 고정 문장만 돌아간다.
    expect(result.formError).toBe(
      '탈퇴를 처리하지 못했습니다. 계정은 그대로입니다. 다시 시도해 주세요.',
    )
    expect(stub.client.auth.signOut).not.toHaveBeenCalled()
  })

  it('should treat "no row came back" as a failure — RLS silently updates zero rows', async () => {
    // Arrange
    stub = signedIn([{ data: null, error: null }])

    // Act
    const result = await withdrawAccountAction(EMPTY_FORM_STATE, form())

    // Assert
    expect(result.formError).toContain('탈퇴를 처리하지 못했습니다')
    expect(stub.client.auth.signOut).not.toHaveBeenCalled()
  })
})

describe('restoreAccountAction', () => {
  it('should send an anonymous visitor to the login page with the restore path as next', async () => {
    // Arrange & Act
    const promise = restoreAccountAction(EMPTY_FORM_STATE, form({ next: '/community' }))

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/login?next=${encodeURIComponent('/auth/restore')}`,
    )
  })

  it('should clear deleted_at and continue to the sanitized destination', async () => {
    // Arrange — 1) 현재 상태 조회 2) 갱신 결과
    stub = signedIn([
      { data: { deleted_at: DELETED_AT, purged_at: null }, error: null },
      { data: { deleted_at: null }, error: null },
    ])

    // Act
    const promise = restoreAccountAction(EMPTY_FORM_STATE, form({ next: '/community/write' }))

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/community/write`)
    expect(stub.updates).toEqual([{ deleted_at: null }])
  })

  it('should fall back to the home path when next is off-origin', async () => {
    // Arrange
    stub = signedIn([
      { data: { deleted_at: DELETED_AT, purged_at: null }, error: null },
      { data: { deleted_at: null }, error: null },
    ])

    // Act
    const promise = restoreAccountAction(EMPTY_FORM_STATE, form({ next: 'https://evil.example' }))

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/`)
  })

  it('should just continue when the account is already active', async () => {
    // Arrange — 다른 탭에서 이미 복구된 경우
    stub = signedIn([{ data: { deleted_at: null, purged_at: null }, error: null }])

    // Act
    const promise = restoreAccountAction(EMPTY_FORM_STATE, form({ next: '/account' }))

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/account`)
    expect(stub.updates).toHaveLength(0)
  })

  it('should refuse to restore a purged account and explain why', async () => {
    // Arrange
    stub = signedIn([
      { data: { deleted_at: DELETED_AT, purged_at: '2026-12-09T00:00:00.000Z' }, error: null },
    ])

    // Act
    const result = await restoreAccountAction(EMPTY_FORM_STATE, form())

    // Assert
    expect(result.formError).toContain('이미 파기되었습니다')
    expect(stub.updates).toHaveLength(0)
  })

  it('should report a failure when deleted_at is still set after the update', async () => {
    // Arrange — 트리거가 되돌린 경우(예: 파기 완료 직후 경합)
    stub = signedIn([
      { data: { deleted_at: DELETED_AT, purged_at: null }, error: null },
      { data: { deleted_at: DELETED_AT }, error: null },
    ])

    // Act
    const result = await restoreAccountAction(EMPTY_FORM_STATE, form())

    // Assert
    expect(result.formError).toBe(
      '계정을 복구하지 못했습니다. 탈퇴 상태는 그대로입니다. 다시 시도해 주세요.',
    )
  })
})
