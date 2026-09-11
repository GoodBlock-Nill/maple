import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

/**
 * 마이페이지 v2 서버 액션 — 닉네임 · 월드 계정 연동 · 마케팅 동의 · 아바타 업로드.
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

const {
  updateMarketingConsentAction,
  updateMswLinkAction,
  updateNicknameAction,
  uploadAvatarAction,
} = await import('@/lib/actions/profile-actions')
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

describe('updateNicknameAction', () => {
  const valid = { nickname: '모험가' }

  beforeEach(() => {
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('should send an anonymous visitor to the login page', async () => {
    // Arrange
    stub.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const promise = updateNicknameAction(EMPTY_FORM_STATE, form(valid))

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/login?next=${encodeURIComponent('/account')}`,
    )
  })

  it('should save only the nickname, then refresh the current route', async () => {
    // Arrange & Act
    const result = await updateNicknameAction(EMPTY_FORM_STATE, form(valid))

    // Assert — 이름·월드 계정은 이 폼의 관심사가 아니다(칸이 없으므로 덮어쓰면 안 된다).
    expect(stub.updates).toEqual([{ nickname: '모험가' }])
    expect(refresh).toHaveBeenCalled()
    expect(result.message).toBe('닉네임을 변경했습니다.')
  })

  it('should reject a nickname that breaks the shared rule before writing anything', async () => {
    // Arrange & Act — 규칙은 온보딩과 같은 `nicknameSchema` 하나다.
    const result = await updateNicknameAction(EMPTY_FORM_STATE, form({ nickname: '모 험가' }))

    // Assert
    expect(result.fieldErrors?.nickname).toBeDefined()
    expect(stub.updates).toHaveLength(0)
  })

  it('should explain a nickname collision instead of leaking the constraint', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: null, error: { code: '23505', message: 'duplicate key' } }])
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    // Act
    const result = await updateNicknameAction(EMPTY_FORM_STATE, form(valid))

    // Assert
    expect(result.fieldErrors?.nickname).toBe('이미 사용 중인 닉네임입니다.')
    expect(refresh).not.toHaveBeenCalled()
  })
})

describe('updateMswLinkAction', () => {
  const valid = { mswUid: '20123456789000000', mswProfileCode: '#abcd0' }

  beforeEach(() => {
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('should refuse while the world-account flag is off', async () => {
    // Arrange & Act — 플래그가 꺼져 있으면 화면도 비활성이지만 직접 POST 가 남는다.
    const result = await updateMswLinkAction(EMPTY_FORM_STATE, form(valid))

    // Assert
    expect(result.formError).toBe('월드 계정 연동은 준비 중입니다.')
    expect(stub.updates).toHaveLength(0)
  })

  /* `FEATURES` 는 모듈 로드 시점에 env 를 한 번 읽는다 — 켠 상태를 보려면
     env 설정 → resetModules → 재 import 순서를 지켜야 한다. */
  it('should save both columns once the flag is on', async () => {
    // Arrange
    const original = process.env.NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS
    process.env.NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS = 'true'
    vi.resetModules()

    try {
      const enabled = await import('@/lib/actions/profile-actions')

      // Act
      const result = await enabled.updateMswLinkAction(EMPTY_FORM_STATE, form(valid))

      // Assert — 프로필 코드는 스키마가 소문자 "#" 형태로 정규화해서 넘긴다.
      expect(stub.updates).toEqual([{ msw_uid: '20123456789000000', msw_profile_code: '#abcd0' }])
      expect(result.message).toBe('계정이 연동되었습니다')
    } finally {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS
      } else {
        process.env.NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS = original
      }
      vi.resetModules()
    }
  })

  it('should explain a uid that already belongs to another account', async () => {
    // Arrange
    const original = process.env.NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS
    process.env.NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS = 'true'
    vi.resetModules()
    stub = createSupabaseStub([
      {
        data: null,
        error: {
          code: '23505',
          message: 'duplicate key value violates unique constraint "profiles_msw_uid_key"',
        },
      },
    ])
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })

    try {
      const enabled = await import('@/lib/actions/profile-actions')

      // Act
      const result = await enabled.updateMswLinkAction(EMPTY_FORM_STATE, form(valid))

      // Assert
      expect(result.fieldErrors?.mswUid).toContain('이미 다른 계정에 연결된')
    } finally {
      if (original === undefined) {
        delete process.env.NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS
      } else {
        process.env.NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS = original
      }
      vi.resetModules()
    }
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

describe('updateMarketingConsentAction', () => {
  beforeEach(() => {
    stub.client.auth.getUser.mockResolvedValue({ data: { user: { id: USER_ID } }, error: null })
  })

  it('should clear both opt-out columns when the member agrees', async () => {
    // Arrange & Act — 화면은 체크박스 하나, DB 는 여전히 두 칸이다(시안 v2 §3.2).
    const result = await updateMarketingConsentAction(true)

    // Assert
    expect(result).toEqual({ ok: true })
    expect(stub.updates).toEqual([{ marketing_sms_opt_out: false, marketing_email_opt_out: false }])
  })

  it('should set both opt-out columns when the member withdraws consent', async () => {
    // Arrange & Act
    await updateMarketingConsentAction(false)

    // Assert
    expect(stub.updates).toEqual([{ marketing_sms_opt_out: true, marketing_email_opt_out: true }])
  })

  it('should refuse a value that is not a boolean', async () => {
    // Arrange & Act — 직접 POST 로도 호출될 수 있어 서버에서 다시 좁힌다.
    const result = await updateMarketingConsentAction('true' as unknown as boolean)

    // Assert
    expect(result.ok).toBe(false)
    expect(stub.updates).toHaveLength(0)
  })

  it('should refuse an anonymous caller', async () => {
    // Arrange
    stub.client.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })

    // Act
    const result = await updateMarketingConsentAction(true)

    // Assert
    expect(result.ok).toBe(false)
    expect(stub.updates).toHaveLength(0)
  })
})
