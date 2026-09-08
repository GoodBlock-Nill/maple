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

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePath(path),
  revalidateTag: vi.fn(),
}))

const getCurrentUser = vi.fn()
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: () => getCurrentUser() }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { deleteComment, deletePost, updatePost } = await import('@/lib/actions/post-edit-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

const USER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', nickname: '모험가', role: 'user' }
const OTHER_ID = 'aaaaaaaa-0000-4000-8000-000000000002'
const POST_ID = '22222222-0000-4000-8000-000000000001'
const COMMENT_ID = '33333333-0000-4000-8000-000000000001'

function postForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData()
  const values = { category: 'info', title: '고친 제목', content: '고친 본문', ...overrides }

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

/** 액션이 소비하는 순서: 소유자 조회 → update. */
function stubFor(authorId: string | null, writeError: unknown = null) {
  return createSupabaseStub([
    { data: authorId === null ? null : { author_id: authorId }, error: null },
    { data: null, error: writeError },
  ])
}

beforeEach(() => {
  getCurrentUser.mockReset()
  revalidatePath.mockReset()
  stub = createSupabaseStub()
})

describe('updatePost', () => {
  it('should refuse to write when there is no session', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(null)

    // Act
    const result = await updatePost(POST_ID, EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toContain('로그인')
    expect(stub.updates).toHaveLength(0)
  })

  it('should return field errors before touching the database', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await updatePost(POST_ID, EMPTY_FORM_STATE, postForm({ title: '' }))

    // Assert
    expect(result.fieldErrors?.title).toBeDefined()
    expect(stub.tables).toHaveLength(0)
  })

  it('should reject an id that is not a uuid', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await updatePost('42', EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toContain('찾을 수 없습니다')
  })

  it('should refuse to edit a post written by someone else', async () => {
    // Arrange — RLS 도 막지만, 정책만 믿으면 "0건 갱신 + 성공"으로 조용히 끝난다.
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor(OTHER_ID)

    // Act
    const result = await updatePost(POST_ID, EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toBe('본인이 작성한 글만 수정하거나 삭제할 수 있습니다.')
    expect(stub.updates).toHaveLength(0)
  })

  it('should report a missing or already deleted post', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor(null)

    // Act
    const result = await updatePost(POST_ID, EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toContain('찾을 수 없습니다')
  })

  it('should never leak the raw database message', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor(USER.id, { code: '42501', message: 'row-level security policy' })

    // Act
    const result = await updatePost(POST_ID, EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toBe('글을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })

  it('should write only the editable columns and redirect to the detail page', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor(USER.id)

    // Act
    const promise = updatePost(POST_ID, EMPTY_FORM_STATE, postForm())

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/community/${POST_ID}`)
    expect(stub.updates[0]).toMatchObject({
      category_key: 'info',
      title: '고친 제목',
      content: '고친 본문',
    })
    /* 시각 컬럼은 보내지 않는다 — updated_at / edited_at 은 트리거가 채운다. */
    expect(Object.keys(stub.updates[0] as object)).toEqual(['category_key', 'title', 'content'])
    expect(revalidatePath).toHaveBeenCalledWith(`/community/${POST_ID}`)
  })
})

describe('deletePost', () => {
  it('should refuse to delete when there is no session', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(null)

    // Act
    const result = await deletePost(POST_ID, EMPTY_FORM_STATE)

    // Assert
    expect(result.formError).toContain('로그인')
  })

  it('should refuse to delete a post written by someone else', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor(OTHER_ID)

    // Act
    const result = await deletePost(POST_ID, EMPTY_FORM_STATE)

    // Assert
    expect(result.formError).toContain('본인이 작성한 글만')
    expect(stub.updates).toHaveLength(0)
  })

  it('should soft delete and send the author back to the list with a flash flag', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor(USER.id)

    // Act
    const promise = deletePost(POST_ID, EMPTY_FORM_STATE)

    // Assert
    await expect(promise).rejects.toThrow(`${REDIRECT_PREFIX}/community?deleted=1`)
    expect(Object.keys(stub.updates[0] as object)).toEqual(['deleted_at'])
  })
})

describe('deleteComment', () => {
  it('should reject ids that are not uuids', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await deleteComment(POST_ID, '42', EMPTY_FORM_STATE)

    // Assert
    expect(result.formError).toContain('찾을 수 없습니다')
    expect(stub.tables).toHaveLength(0)
  })

  it('should refuse to delete a comment written by someone else', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor(OTHER_ID)

    // Act
    const result = await deleteComment(POST_ID, COMMENT_ID, EMPTY_FORM_STATE)

    // Assert
    expect(result.formError).toBe('본인이 작성한 댓글만 삭제할 수 있습니다.')
    expect(stub.updates).toHaveLength(0)
  })

  it('should soft delete the comment and revalidate the detail page', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor(USER.id)

    // Act
    const result = await deleteComment(POST_ID, COMMENT_ID, EMPTY_FORM_STATE)

    // Assert
    expect(result.message).toBe('댓글을 삭제했습니다.')
    expect(stub.tables).toEqual(['comments', 'comments'])
    expect(Object.keys(stub.updates[0] as object)).toEqual(['deleted_at'])
    expect(revalidatePath).toHaveBeenCalledWith(`/community/${POST_ID}`)
  })
})
