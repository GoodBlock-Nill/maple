import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 뉴스 쓰기 액션의 상단 고정 한도(3개) 가드.
 *
 * 확인하는 것은 넷이다.
 *   1. 저장 전에 미리 세어 한도를 넘기면 필드 오류로 막고, DB 를 건드리지 않는다.
 *   2. 세는 대상에서 **자기 자신은 뺀다** — 이미 고정된 글을 그대로 저장해도
 *      스스로 때문에 막히지 않는다(`getPinnedNewsSummary(excludeId)`).
 *   3. 임시저장은 한도에 넣지 않는다 — 클라이언트에 보이지 않는 고정 표시는 세지
 *      않는다.
 *   4. 사전 검사를 통과한 뒤 DB 트리거(`guard_news_pin_limit`)가 막는 레이스도
 *      원문을 그대로 보여 주지 않고 같은 한국어 문구로 옮긴다.
 */

/* 정제기는 이미지 허용 접두사를 환경 변수에서 읽는다(액션이 옵션 없이 부른다). */
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const POST_ID = '22222222-2222-4222-8222-222222222222'

/* 이미 고정된 세 글. excludeId 로 넘어온 값만 제외하고 세도록 흉내 낸다 — 실제
   `getPinnedNewsSummary()` 의 "자기 자신 제외" 동작을 모델링한다. */
const PINNED_IDS = [
  'aaaaaaaa-0000-4000-8000-000000000001',
  POST_ID,
  'aaaaaaaa-0000-4000-8000-000000000003',
]

const ACTOR = {
  id: ADMIN_ID,
  email: 'admin@stub.local',
  nickname: '운영자',
  role: 'admin',
  roleKey: 'super_admin',
  roleName: '슈퍼어드민',
  permissions: { news: 'write' },
  isSuperAdmin: true,
}

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ACTOR),
  requireAnyPermission: vi.fn(async () => ACTOR),
  requireSuperAdmin: vi.fn(async () => ACTOR),
  requirePermission: vi.fn(async () => ACTOR),
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/revalidate', () => ({
  CLIENT_CACHE_TAGS: { newsList: 'news-list' },
  revalidateClient: vi.fn(async () => ({ ok: true })),
}))
vi.mock('next/navigation', () => ({
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`)
  }),
}))

const getPinnedNewsSummary = vi.fn(async (excludeId?: string) => {
  const remaining = PINNED_IDS.filter((id) => id !== excludeId)

  return {
    count: remaining.length,
    posts: remaining.map((id) => ({ id, title: `[고정] ${id.slice(-4)}` })),
    hasError: false,
  }
})

vi.mock('@/lib/data/news', () => ({
  getPinnedNewsSummary: (excludeId?: string) => getPinnedNewsSummary(excludeId),
}))

type Row = Record<string, unknown> | null

const db = {
  currentRow: null as Row,
  insertError: null as { message: string } | null,
  updateError: null as { message: string } | null,
  stateRows: [] as Record<string, unknown>[],
  stateError: null as { message: string } | null,
}

const inserts: Record<string, unknown>[] = []
const updates: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/server', () => {
  function builder() {
    let mode: 'select' | 'insert' | 'update' = 'select'

    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      in: () => chain,
      insert: (payload: Record<string, unknown>) => {
        mode = 'insert'
        inserts.push(payload)

        return chain
      },
      update: (payload: Record<string, unknown>) => {
        mode = 'update'
        updates.push(payload)

        return chain
      },
      maybeSingle: async () => ({ data: db.currentRow, error: null }),
      single: async () =>
        mode === 'insert'
          ? {
              data:
                db.insertError === null ? { id: POST_ID, ...inserts[inserts.length - 1] } : null,
              error: db.insertError,
            }
          : {
              data:
                db.updateError === null ? { id: POST_ID, ...updates[updates.length - 1] } : null,
              error: db.updateError,
            },
      // newsStateAction 은 select-현재 · update-일괄 둘 다 .single()/.maybeSingle() 없이
      // 그대로 await 한다. mode 로 어느 쪽인지 가른다.
      then: (resolve: (value: unknown) => unknown) =>
        resolve(mode === 'update' ? { error: db.stateError } : { data: db.stateRows, error: null }),
    }

    return chain
  }

  return { createClient: async () => ({ from: () => builder() }) }
})

const { saveNewsAction, newsStateAction } = await import('@/lib/actions/news-actions')
const { NEWS_PIN_LIMIT_MESSAGE } = await import('@/lib/constants/news')

function formData(fields: Record<string, string>, pinned: boolean): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  if (pinned) {
    data.set('isPinned', 'on')
  }

  return data
}

const BASE_FIELDS = {
  categoryKey: 'notice',
  title: '점검 안내',
  summary: '',
  content: '<p>본문</p>',
  publishMode: 'now',
  scheduledAt: '',
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  getPinnedNewsSummary.mockClear()
  inserts.length = 0
  updates.length = 0
  db.currentRow = {
    id: POST_ID,
    title: '옛 제목',
    category_key: 'notice',
    is_published: true,
    published_at: '2026-01-01T00:00:00.000Z',
    is_hidden: false,
    deleted_at: null,
  }
  db.insertError = null
  db.updateError = null
  db.stateRows = [db.currentRow!]
  db.stateError = null
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('createNews — 상단 고정 한도', () => {
  it('should block a new pinned post once 3 posts are already pinned', async () => {
    // Arrange & Act — 새 글이라 excludeId 없이 세 건이 그대로 잡힌다.
    const result = await saveNewsAction({}, formData(BASE_FIELDS, true))

    // Assert
    expect(result.fieldErrors?.isPinned).toContain(NEWS_PIN_LIMIT_MESSAGE)
    expect(inserts).toHaveLength(0)
  })

  it('should list the currently pinned titles as a hint', async () => {
    const result = await saveNewsAction({}, formData(BASE_FIELDS, true))

    expect(result.fieldErrors?.isPinned).toContain('현재 고정')
  })

  it('should not touch the pin summary when the checkbox is off', async () => {
    await expect(saveNewsAction({}, formData(BASE_FIELDS, false))).rejects.toThrow('NEXT_REDIRECT')

    expect(getPinnedNewsSummary).not.toHaveBeenCalled()
  })

  it('should not count a draft toward the limit', async () => {
    // Arrange & Act — 임시저장은 발행되지 않으므로 한도 검사를 건너뛴다.
    await expect(
      saveNewsAction({}, formData({ ...BASE_FIELDS, publishMode: 'draft' }, true)),
    ).rejects.toThrow('NEXT_REDIRECT')

    // Assert — 저장까지 도달했다(막히지 않았다).
    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({ is_pinned: true, is_published: false })
  })

  it('should allow pinning when under the limit', async () => {
    getPinnedNewsSummary.mockResolvedValueOnce({ count: 2, posts: [], hasError: false })

    await expect(saveNewsAction({}, formData(BASE_FIELDS, true))).rejects.toThrow('NEXT_REDIRECT')

    expect(inserts).toHaveLength(1)
    expect(inserts[0]).toMatchObject({ is_pinned: true })
  })
})

describe('updateNews — 상단 고정 한도', () => {
  it('should let an already-pinned post save itself without tripping the limit', async () => {
    // Arrange — POST_ID 는 PINNED_IDS 안에 있다. excludeId 가 자신을 빼 count=2 다.
    const result = await saveNewsAction(
      {},
      (() => {
        const data = formData(BASE_FIELDS, true)

        data.set('id', POST_ID)

        return data
      })(),
    )

    // Assert
    expect(result.fieldErrors?.isPinned).toBeUndefined()
    expect(result.message).toBe('저장했습니다.')
    expect(updates).toHaveLength(1)
  })

  it('should block pinning a different post once the limit is full', async () => {
    // Arrange — 고정되지 않은 다른 글이라 excludeId 가 세 건을 빼지 못한다.
    const OTHER_ID = '33333333-3333-4333-8333-333333333333'

    db.currentRow = { ...db.currentRow, id: OTHER_ID }
    db.stateRows = [db.currentRow!]

    const data = formData(BASE_FIELDS, true)

    data.set('id', OTHER_ID)

    // Act
    const result = await saveNewsAction({}, data)

    // Assert
    expect(result.fieldErrors?.isPinned).toContain(NEWS_PIN_LIMIT_MESSAGE)
    expect(updates).toHaveLength(0)
  })

  it('should not leak the raw Postgres message when the DB trigger rejects a race', async () => {
    // Arrange — 사전 검사는 통과했지만(count=2) 트리거가 막은 상황을 흉내 낸다.
    getPinnedNewsSummary.mockResolvedValueOnce({ count: 2, posts: [], hasError: false })
    db.updateError = { message: 'news_pin_limit_exceeded' }

    const data = formData(BASE_FIELDS, true)

    data.set('id', POST_ID)

    // Act
    const result = await saveNewsAction({}, data)

    // Assert
    expect(result.fieldErrors?.isPinned).toBe(NEWS_PIN_LIMIT_MESSAGE)
    expect(errorSpy).toHaveBeenCalled()
  })
})

describe('newsStateAction — 숨김 해제가 한도를 되넘길 때', () => {
  it('should translate the trigger error into the same Korean message', async () => {
    // Arrange
    db.stateError = { message: 'news_pin_limit_exceeded' }

    const data = new FormData()

    data.set('intent', 'unhide')
    data.append('ids', POST_ID)

    // Act
    const result = await newsStateAction({}, data)

    // Assert
    expect(result.formError).toBe(NEWS_PIN_LIMIT_MESSAGE)
    expect(result.formError).not.toContain('news_pin_limit_exceeded')
  })

  it('should keep the generic failure message for unrelated errors', async () => {
    db.stateError = { message: 'permission denied for table posts' }

    const data = new FormData()

    data.set('intent', 'hide')
    data.append('ids', POST_ID)

    const result = await newsStateAction({}, data)

    expect(result.formError).toBe('처리하지 못했습니다. 잠시 후 다시 시도해 주세요.')
  })
})
