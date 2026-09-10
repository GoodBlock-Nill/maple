import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

/**
 * 마이페이지 계정 관리 서버 액션.
 *
 * 실제 권한은 RLS(`profiles_update_self` · `avatars_insert_own`)가 강제한다.
 * 여기서 재는 것은 "무엇이 DB·스토리지까지 도달하는가" 하나다.
 */

const REDIRECT_PREFIX = 'NEXT_REDIRECT:'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_PREFIX}${path}`)
  },
}))

const refresh = vi.fn()
vi.mock('next/cache', () => ({ refresh: (...args: unknown[]) => refresh(...args) }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { updateMarketingAction, updateProfileAction, uploadAvatarAction } =
  await import('@/lib/actions/profile-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'

function form(values: Record<string, string>): FormData {
  const formData = new FormData()

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

function fileForm(options: { type?: string; size?: number } = {}): FormData {
  const { type = 'image/png', size = 1024 } = options
  const formData = new FormData()

  formData.set('file', new File([new Uint8Array(size)], 'photo.png', { type }))

  return formData
}

beforeEach(() => {
  stub = createSupabaseStub()
  refresh.mockReset()
})

describe('updateProfileAction', () => {
  const valid = { name: '홍길동', nickname: '모험가' }

  beforeEach(() => {
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('should send an anonymous visitor to the login page', async () => {
    // Arrange
    stub.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const promise = updateProfileAction(EMPTY_FORM_STATE, form(valid))

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/login?next=${encodeURIComponent('/account')}`,
    )
  })

  it('should save the name and nickname, then refresh the current route', async () => {
    // Arrange & Act
    const result = await updateProfileAction(EMPTY_FORM_STATE, form(valid))

    // Assert
    const [payload] = stub.updates as [Record<string, unknown>]
    expect(payload.name).toBe('홍길동')
    expect(payload.nickname).toBe('모험가')
    /* 플래그가 꺼져 있으면 월드 계정은 payload 에 실리지 않는다(기존 값 보존). */
    expect(payload.msw_uid).toBeUndefined()
    expect(refresh).toHaveBeenCalled()
    expect(result.message).toBe('프로필을 저장했습니다.')
  })

  it('should store an empty name as null so it can be cleared', async () => {
    // Arrange & Act
    await updateProfileAction(EMPTY_FORM_STATE, form({ name: '   ', nickname: '모험가' }))

    // Assert
    const [payload] = stub.updates as [Record<string, unknown>]
    expect(payload.name).toBeNull()
  })

  it('should reject a name over 20 characters before writing anything', async () => {
    // Arrange & Act
    const result = await updateProfileAction(
      EMPTY_FORM_STATE,
      form({ name: '가'.repeat(21), nickname: '모험가' }),
    )

    // Assert
    expect(result.fieldErrors?.name).toBeDefined()
    expect(stub.updates).toHaveLength(0)
  })

  it('should explain a nickname collision instead of leaking the constraint', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: null, error: { code: '23505', message: 'duplicate key' } }])
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // Act
    const result = await updateProfileAction(EMPTY_FORM_STATE, form(valid))

    // Assert
    expect(result.fieldErrors?.nickname).toBe('이미 사용 중인 닉네임입니다.')
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('uploadAvatarAction', () => {
  beforeEach(() => {
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('should refuse an anonymous caller without touching storage', async () => {
    // Arrange
    stub.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const result = await uploadAvatarAction(fileForm())

    // Assert
    expect(result).toEqual({ ok: false, message: '로그인 후 이용할 수 있습니다.' })
    expect(stub.uploads).toHaveLength(0)
  })

  it('should refuse a form without a file', async () => {
    // Arrange & Act
    const result = await uploadAvatarAction(new FormData())

    // Assert
    expect(result.ok).toBe(false)
    expect(stub.uploads).toHaveLength(0)
  })

  it('should refuse a mime the bucket does not allow', async () => {
    // Arrange & Act
    const result = await uploadAvatarAction(fileForm({ type: 'image/gif' }))

    // Assert
    expect(result.ok).toBe(false)
    expect(stub.uploads).toHaveLength(0)
  })

  it('should upload under the caller uid and save a cache-busted public url', async () => {
    // Arrange & Act
    const result = await uploadAvatarAction(fileForm({ type: 'image/webp' }))

    // Assert — 정책(`avatars_insert_own`)이 요구하는 `{uid}/…` 접두사.
    expect(stub.uploads).toEqual([
      { bucket: 'avatars', path: `${USER_ID}/avatar.webp`, contentType: 'image/webp' },
    ])
    expect(result.ok).toBe(true)
    expect(result.ok === true && result.url).toContain(`/avatars/${USER_ID}/avatar.webp?v=`)

    const [payload] = stub.updates as [Record<string, unknown>]
    expect(String(payload.avatar_url)).toContain('avatar.webp?v=')
  })

  it('should remove the other extensions so an old photo cannot linger', async () => {
    // Arrange & Act
    await uploadAvatarAction(fileForm({ type: 'image/png' }))

    // Assert
    expect(stub.removals).toEqual([[`${USER_ID}/avatar.jpg`, `${USER_ID}/avatar.webp`]])
  })

  it('should report a storage failure without writing the profile', async () => {
    // Arrange
    stub.uploadError = { message: 'boom' }

    // Act
    const result = await uploadAvatarAction(fileForm())

    // Assert
    expect(result.ok).toBe(false)
    expect(stub.updates).toHaveLength(0)
  })
})

describe('updateMarketingAction', () => {
  beforeEach(() => {
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('should write only the column that belongs to the channel', async () => {
    // Arrange & Act
    const result = await updateMarketingAction('sms', true)

    // Assert
    expect(result).toEqual({ ok: true })
    expect(stub.updates).toEqual([{ marketing_sms_opt_out: true }])
  })

  it('should write the email column for the email channel', async () => {
    // Arrange & Act
    await updateMarketingAction('email', false)

    // Assert
    expect(stub.updates).toEqual([{ marketing_email_opt_out: false }])
  })

  it('should refuse a channel it does not know', async () => {
    // Arrange & Act — 직접 POST 로도 호출될 수 있어 서버에서 다시 좁힌다.
    const result = await updateMarketingAction('push' as 'sms', true)

    // Assert
    expect(result.ok).toBe(false)
    expect(stub.updates).toHaveLength(0)
  })

  it('should refuse an anonymous caller', async () => {
    // Arrange
    stub.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const result = await updateMarketingAction('sms', true)

    // Assert
    expect(result.ok).toBe(false)
    expect(stub.updates).toHaveLength(0)
  })
})
