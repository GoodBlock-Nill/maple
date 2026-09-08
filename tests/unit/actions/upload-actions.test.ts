import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST_IMAGE_MAX_BYTES } from '@/lib/supabase/storage'

/**
 * 업로드 서버 액션 계약.
 *
 * 스토리지는 `lib/actions/supabase-stub` 이 흉내 내지 않는 영역이라 여기서 최소한의
 * 스텁을 따로 만든다. 검증하는 것은 "무엇이 스토리지까지 도달하는가" 하나다 —
 * 실제 권한은 RLS(`post_images_insert_own`)가 강제하므로 그 판정을 대신 재지 않는다.
 */

const getCurrentUser = vi.fn()
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: () => getCurrentUser() }))

type ListItem = { created_at: string }

type StorageStub = {
  uploads: { path: string; contentType: string | undefined }[]
  listResult: ListItem[]
  uploadError: { message: string } | null
}

let storage: StorageStub

function createStorage(): StorageStub {
  return { uploads: [], listResult: [], uploadError: null }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    storage: {
      from: () => ({
        list: async () => ({ data: storage.listResult, error: null }),
        upload: async (path: string, _file: File, options?: { contentType?: string }) => {
          storage.uploads.push({ path, contentType: options?.contentType })

          return { data: { path }, error: storage.uploadError }
        },
        getPublicUrl: (path: string) => ({
          data: {
            publicUrl: `https://stub.supabase.co/storage/v1/object/public/post-images/${path}`,
          },
        }),
      }),
    },
  }),
}))

const { uploadPostImage } = await import('@/lib/actions/upload-actions')

const USER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', nickname: '모험가', role: 'user' }

function fileForm(options: { type?: string; size?: number } = {}): FormData {
  const { type = 'image/png', size = 1024 } = options
  const formData = new FormData()

  formData.set('file', new File([new Uint8Array(size)], 'photo.png', { type }))

  return formData
}

beforeEach(() => {
  getCurrentUser.mockReset()
  getCurrentUser.mockResolvedValue(USER)
  storage = createStorage()
})

describe('uploadPostImage', () => {
  it('should refuse to upload when there is no session', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(null)

    // Act
    const result = await uploadPostImage(fileForm())

    // Assert
    expect(result).toEqual({ ok: false, message: '로그인 후 이용할 수 있습니다.' })
    expect(storage.uploads).toHaveLength(0)
  })

  it('should ask for a file when the form carries none', async () => {
    // Arrange & Act
    const result = await uploadPostImage(new FormData())

    // Assert
    expect(result.ok).toBe(false)
    expect(storage.uploads).toHaveLength(0)
  })

  it('should reject a mime type outside the bucket allow list', async () => {
    // Arrange & Act
    const result = await uploadPostImage(fileForm({ type: 'image/svg+xml' }))

    // Assert
    expect(result.ok).toBe(false)
    expect(storage.uploads).toHaveLength(0)
  })

  it('should reject a file over the size limit before touching storage', async () => {
    // Arrange & Act
    const result = await uploadPostImage(fileForm({ size: POST_IMAGE_MAX_BYTES + 1 }))

    // Assert
    expect(result.ok).toBe(false)
    expect(storage.uploads).toHaveLength(0)
  })

  it('should store the object under the uploader uid and current year', async () => {
    // Arrange
    const year = new Date().getFullYear()

    // Act
    const result = await uploadPostImage(fileForm())

    // Assert
    expect(result.ok).toBe(true)
    expect(storage.uploads[0]?.path).toMatch(
      new RegExp(`^${USER.id}/${year}/[0-9a-f-]{36}\\.png$`, 'u'),
    )
    expect(storage.uploads[0]?.contentType).toBe('image/png')
  })

  it('should return the public url of the uploaded object', async () => {
    // Arrange & Act
    const result = await uploadPostImage(fileForm())

    // Assert
    expect(result.ok && result.url).toContain(
      `https://stub.supabase.co/storage/v1/object/public/post-images/${USER.id}/`,
    )
  })

  it('should block uploading once the recent window is full', async () => {
    // Arrange — 최근 20개가 모두 방금 올라간 상태
    storage.listResult = Array.from({ length: 20 }, () => ({
      created_at: new Date().toISOString(),
    }))

    // Act
    const result = await uploadPostImage(fileForm())

    // Assert
    expect(result.ok).toBe(false)
    expect(result.ok || result.message).toContain('초 후에')
    expect(storage.uploads).toHaveLength(0)
  })

  it('should allow uploading again once the oldest of the window aged out', async () => {
    // Arrange — 창(60초)을 벗어난 오래된 항목들
    const old = new Date(Date.now() - 120_000).toISOString()
    storage.listResult = Array.from({ length: 20 }, () => ({ created_at: old }))

    // Act
    const result = await uploadPostImage(fileForm())

    // Assert
    expect(result.ok).toBe(true)
  })

  it('should surface a friendly message when storage rejects the upload', async () => {
    // Arrange — RLS 위반 등
    storage.uploadError = { message: 'new row violates row-level security policy' }

    // Act
    const result = await uploadPostImage(fileForm())

    // Assert
    expect(result).toEqual({
      ok: false,
      message: '이미지를 올리지 못했습니다. 잠시 후 다시 시도해 주세요.',
    })
  })
})
