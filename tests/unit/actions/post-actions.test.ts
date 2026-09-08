import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

/** `redirect()` 는 예외를 던져 렌더를 중단시킨다. 테스트에서도 같은 계약을 흉내 낸다. */
const REDIRECT_PREFIX = 'NEXT_REDIRECT:'

vi.mock('next/navigation', () => ({
  redirect: (path: string) => {
    throw new Error(`${REDIRECT_PREFIX}${path}`)
  },
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}))

const getCurrentUser = vi.fn()
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: () => getCurrentUser() }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { createComment, createPost } = await import('@/lib/actions/post-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

const USER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', nickname: '모험가', role: 'user' }
const POST_ID = '22222222-0000-4000-8000-000000000001'

function postForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData()
  const values = { category: 'chat', title: '제목입니다', content: '본문입니다', ...overrides }

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

function commentForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData()
  const values = { postId: POST_ID, content: '좋은 글이네요', ...overrides }

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

beforeEach(() => {
  getCurrentUser.mockReset()
  stub = createSupabaseStub()
})

describe('createPost', () => {
  it('should refuse to write when there is no session', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(null)

    // Act
    const result = await createPost(EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toContain('로그인')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should return field errors when the input is invalid', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await createPost(EMPTY_FORM_STATE, postForm({ title: '' }))

    // Assert
    expect(result.fieldErrors?.title).toBeDefined()
    expect(stub.inserts).toHaveLength(0)
  })

  it('should reject a news category so the news board stays admin only', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await createPost(EMPTY_FORM_STATE, postForm({ category: 'notice' }))

    // Assert
    expect(result.fieldErrors?.category).toBeDefined()
  })

  it('should block writing again within the cooldown window', async () => {
    // Arrange — 마지막 글이 방금 등록된 상태
    getCurrentUser.mockResolvedValue(USER)
    stub = createSupabaseStub([{ data: { created_at: new Date().toISOString() }, error: null }])

    // Act
    const result = await createPost(EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toContain('초 후에')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should surface a friendly message when the insert is rejected', async () => {
    // Arrange — RLS 위반 등
    getCurrentUser.mockResolvedValue(USER)
    stub = createSupabaseStub([
      { data: null, error: null },
      { data: null, error: { message: 'new row violates row-level security policy' } },
    ])

    // Act
    const result = await createPost(EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toBe('글을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })

  it('should insert with the author snapshot and redirect to the new post', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = createSupabaseStub([
      { data: null, error: null },
      { data: { id: POST_ID }, error: null },
    ])

    // Act
    const promise = createPost(EMPTY_FORM_STATE, postForm())

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/community/${POST_ID}`)
    expect(stub.inserts[0]).toMatchObject({
      board: 'community',
      category_key: 'chat',
      author_id: USER.id,
      author_name: USER.nickname,
    })
  })
})

describe('createComment', () => {
  it('should refuse to write when there is no session', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(null)

    // Act
    const result = await createComment(EMPTY_FORM_STATE, commentForm())

    // Assert
    expect(result.formError).toContain('로그인')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should reject a post id that is not a uuid', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await createComment(EMPTY_FORM_STATE, commentForm({ postId: '42' }))

    // Assert
    expect(result.fieldErrors?.postId).toBeDefined()
  })

  it('should block commenting again within the cooldown window', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = createSupabaseStub([{ data: { created_at: new Date().toISOString() }, error: null }])

    // Act
    const result = await createComment(EMPTY_FORM_STATE, commentForm())

    // Assert
    expect(result.formError).toContain('초 후에')
  })

  it('should insert the comment and report success without redirecting', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = createSupabaseStub([
      { data: null, error: null },
      { data: null, error: null },
    ])

    // Act
    const result = await createComment(EMPTY_FORM_STATE, commentForm())

    // Assert
    expect(result.message).toBe('댓글을 등록했습니다.')
    expect(stub.inserts[0]).toMatchObject({
      post_id: POST_ID,
      author_id: USER.id,
      author_name: USER.nickname,
    })
  })
})
