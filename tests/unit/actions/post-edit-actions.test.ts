import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

/* 본문 정제기가 "우리 스토리지 이미지만 허용" 판정에 쓰는 공개 URL 접두사의 출처다. */
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://stub.supabase.co')

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

const USER = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  nickname: '모험가',
  role: 'user',
  suspendedUntil: null,
  suspensionReason: null,
}
/** 정지 계정. 먼 미래 시각이라 날짜 표기가 오늘과 무관하게 고정된다. */
const SUSPENDED_USER = {
  ...USER,
  suspendedUntil: '2099-01-01T00:00:00.000Z',
  suspensionReason: '도배',
}
const SUSPENDED_NOTICE = '정지된 계정입니다 (2099-01-01까지 · 사유: 도배)'
/** DB 가 42501 로 막았는데 우리가 읽은 프로필은 아직 깨끗할 때의 문구. */
const SUSPENDED_FALLBACK = '정지된 계정입니다. 문의는 고객지원에서 접수해 주세요.'
const RLS_ERROR = { code: '42501', message: 'new row violates row-level security policy' }

const OTHER_ID = 'aaaaaaaa-0000-4000-8000-000000000002'
const POST_ID = '22222222-0000-4000-8000-000000000001'
const COMMENT_ID = '33333333-0000-4000-8000-000000000001'

function postForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData()
  const values = {
    category: 'info',
    title: '고친 제목',
    content: '<p>고친 본문</p>',
    ...overrides,
  }

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
    /* Arrange — 정책 위반(42501)은 정지 안내로 옮겨 적으므로(아래 '정지 계정' 참고)
       여기서는 그 밖의 DB 오류로 제약 이름이 새지 않는지만 본다. */
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor(USER.id, {
      code: '23514',
      message: 'violates check constraint "posts_title_length"',
    })

    // Act
    const result = await updatePost(POST_ID, EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toBe('글을 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(result.formError).not.toContain('constraint')
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
      content: '<p>고친 본문</p>',
    })
    /* 시각 컬럼은 보내지 않는다 — updated_at / edited_at 은 트리거가 채운다. */
    expect(Object.keys(stub.updates[0] as object)).toEqual([
      'category_key',
      'title',
      'content',
      'content_format',
    ])
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

/**
 * 정지 계정은 수정 · 삭제도 막힌다.
 *
 * 정지는 "읽기는 되고 쓰기만 막힌다"는 규칙이고, 글을 고치거나 지우는 것도 쓰기다.
 * 세 액션이 같은 관문(`requireUser`)을 지나므로 문구도 하나다.
 */
describe('정지 계정', () => {
  it('should refuse an update before looking the post up', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(SUSPENDED_USER)

    // Act
    const result = await updatePost(POST_ID, EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toBe(SUSPENDED_NOTICE)
    expect(stub.updates).toHaveLength(0)
  })

  it('should refuse a post delete', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(SUSPENDED_USER)

    // Act
    const result = await deletePost(POST_ID, EMPTY_FORM_STATE)

    // Assert
    expect(result.formError).toBe(SUSPENDED_NOTICE)
    expect(stub.updates).toHaveLength(0)
  })

  it('should refuse a comment delete', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(SUSPENDED_USER)

    // Act
    const result = await deleteComment(POST_ID, COMMENT_ID, EMPTY_FORM_STATE)

    // Assert
    expect(result.formError).toBe(SUSPENDED_NOTICE)
    expect(stub.updates).toHaveLength(0)
  })

  it('should map an RLS violation on update to the suspension notice', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor(USER.id, RLS_ERROR)

    // Act
    const result = await updatePost(POST_ID, EMPTY_FORM_STATE, postForm())

    // Assert
    expect(result.formError).toBe(SUSPENDED_FALLBACK)
  })
})
