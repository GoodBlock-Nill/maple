import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from './supabase-stub'

import type { SupabaseStub } from './supabase-stub'

const revalidatePath = vi.fn()
vi.mock('next/cache', () => ({
  revalidatePath: (path: string) => revalidatePath(path),
  revalidateTag: vi.fn(),
}))

const getCurrentUser = vi.fn()
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: () => getCurrentUser() }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { toggleLike } = await import('@/lib/actions/like-actions')

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

const POST_ID = '22222222-0000-4000-8000-000000000001'
const DETAIL_PATH = `/community/${POST_ID}`

/**
 * 액션이 결과를 소비하는 순서.
 *   1) 마지막 좋아요 시각(연타 판정)
 *   2) 대상 글(공개·미삭제 여부 + 현재 집계)
 *   3) 내 좋아요 행(눌렀는가)
 *   4) insert / delete
 *   5) 반영 후 집계 재조회
 */
type StubOptions = {
  latestLikeAt?: string | null
  post?: { like_count: number } | null
  existing?: { post_id: string } | null
  mutationError?: unknown
  nextCount?: number | null
}

function stubFor({
  latestLikeAt = null,
  post = { like_count: 3 },
  existing = null,
  mutationError = null,
  nextCount = null,
}: StubOptions) {
  return createSupabaseStub([
    { data: latestLikeAt === null ? null : { created_at: latestLikeAt }, error: null },
    { data: post, error: null },
    { data: existing, error: null },
    { data: null, error: mutationError },
    { data: nextCount === null ? null : { like_count: nextCount }, error: null },
  ])
}

beforeEach(() => {
  getCurrentUser.mockReset()
  revalidatePath.mockReset()
  stub = createSupabaseStub()
})

describe('toggleLike', () => {
  it('should ask anonymous visitors to log in without touching the table', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(null)

    // Act
    const result = await toggleLike(POST_ID)

    // Assert
    expect(result).toEqual({
      ok: false,
      requiresLogin: true,
      formError: '로그인 후 이용할 수 있습니다.',
    })
    expect(stub.inserts).toHaveLength(0)
    expect(stub.deletes).toHaveLength(0)
  })

  it('should reject a post id that is not a uuid', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await toggleLike('42')

    // Assert
    expect(result).toEqual({ ok: false, requiresLogin: false, formError: '잘못된 게시글입니다.' })
    expect(stub.tables).toHaveLength(0)
  })

  it('should refuse a post that is missing, unpublished or soft deleted', async () => {
    // Arrange — 조회 정책을 통과하지 못해 행이 없는 경우
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ post: null })

    // Act
    const result = await toggleLike(POST_ID)

    // Assert
    expect(result).toMatchObject({ ok: false, requiresLogin: false })
    expect(result.ok ? '' : result.formError).toContain('찾을 수 없습니다')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should slow down a burst of clicks', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ latestLikeAt: new Date().toISOString() })

    // Act
    const result = await toggleLike(POST_ID)

    // Assert
    expect(result).toMatchObject({ ok: false, requiresLogin: false })
    expect(result.ok ? '' : result.formError).toContain('너무 빠르게')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should insert a like row and answer with the stored count', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ post: { like_count: 3 }, nextCount: 4 })

    // Act
    const result = await toggleLike(POST_ID)

    // Assert
    expect(result).toEqual({ ok: true, liked: true, likeCount: 4 })
    expect(stub.inserts[0]).toEqual({ post_id: POST_ID, user_id: USER.id })
    expect(stub.deletes).toHaveLength(0)
    expect(stub.tables).toEqual(['post_likes', 'posts', 'post_likes', 'post_likes', 'posts'])
  })

  it('should delete the row when the same viewer toggles again', async () => {
    // Arrange — 이미 눌러 둔 상태
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ post: { like_count: 4 }, existing: { post_id: POST_ID }, nextCount: 3 })

    // Act
    const result = await toggleLike(POST_ID)

    // Assert
    expect(result).toEqual({ ok: true, liked: false, likeCount: 3 })
    expect(stub.deletes[0]).toEqual({ post_id: POST_ID, user_id: USER.id })
    expect(stub.inserts).toHaveLength(0)
  })

  it('should treat a duplicate insert as already liked', async () => {
    // Arrange — 다른 탭이 먼저 눌러 복합 PK 가 충돌한 경우
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({
      mutationError: { code: '23505', message: 'duplicate key value' },
      nextCount: 4,
    })

    // Act
    const result = await toggleLike(POST_ID)

    // Assert
    expect(result).toEqual({ ok: true, liked: true, likeCount: 4 })
  })

  it('should fall back to the optimistic count when the reread finds nothing', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ post: { like_count: 3 }, nextCount: null })

    // Act
    const result = await toggleLike(POST_ID)

    // Assert
    expect(result).toEqual({ ok: true, liked: true, likeCount: 4 })
  })

  it('should never leak the raw database message', async () => {
    /* Arrange — 정책 위반(42501)은 정지 안내로 옮겨 적으므로(아래 '정지 계정' 참고)
       여기서는 그 밖의 DB 오류로 제약 이름이 새지 않는지만 본다. */
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({
      mutationError: {
        code: '23503',
        message: 'violates foreign key constraint "post_likes_post_id_fkey"',
      },
    })

    // Act
    const result = await toggleLike(POST_ID)

    // Assert
    expect(result).toEqual({
      ok: false,
      requiresLogin: false,
      formError: '좋아요를 반영하지 못했습니다. 잠시 후 다시 시도해 주세요.',
    })
  })

  it('should revalidate the detail page and the list', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ nextCount: 4 })

    // Act
    await toggleLike(POST_ID)

    // Assert
    expect(revalidatePath).toHaveBeenCalledWith(DETAIL_PATH)
    expect(revalidatePath).toHaveBeenCalledWith('/community')
  })

  it('should not revalidate when the toggle failed', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ mutationError: { code: '42501', message: 'denied' } })

    // Act
    await toggleLike(POST_ID)

    // Assert
    expect(revalidatePath).not.toHaveBeenCalled()
  })
})

describe('정지 계정', () => {
  it('should refuse the toggle with the suspension notice and no write', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(SUSPENDED_USER)

    // Act
    const result = await toggleLike(POST_ID)

    // Assert
    expect(result).toEqual({ ok: false, requiresLogin: false, formError: SUSPENDED_NOTICE })
    expect(stub.inserts).toHaveLength(0)
    expect(stub.deletes).toHaveLength(0)
  })

  it('should map an RLS violation to the suspension notice', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ mutationError: RLS_ERROR })

    // Act
    const result = await toggleLike(POST_ID)

    // Assert
    expect(result).toEqual({ ok: false, requiresLogin: false, formError: SUSPENDED_FALLBACK })
  })
})
