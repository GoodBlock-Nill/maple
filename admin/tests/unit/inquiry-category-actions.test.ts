import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 문의 카테고리 쓰기 액션의 가드.
 *
 * 확인하는 것은 넷이다.
 *   1. 모든 액션이 스스로 `requirePermission('inquiries', 'write')` 를 부른다 —
 *      서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출된다.
 *   2. 이름을 바꾸면 과거 문의도 함께 옮긴다(RPC 한 번 = 한 트랜잭션).
 *   3. 접수된 문의가 있는 카테고리는 삭제되지 않는다. 다이얼로그는 편의이지 인가가 아니다.
 *   4. 저장 뒤 사용자 사이트의 `inquiry-categories` 태그를 태운다 — 그러지 않으면
 *      새 프리필이 최대 5분간 반영되지 않는다.
 */

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const CATEGORY_ID = '22222222-2222-4222-8222-222222222222'
const RAW_ERROR = 'permission denied for table inquiry_categories (policy "…_admin_all")'

const ACTOR = {
  id: ADMIN_ID,
  email: 'admin@stub.local',
  nickname: '운영자',
  role: 'admin',
  roleKey: 'super_admin',
  roleName: '슈퍼어드민',
  permissions: { inquiries: 'write' },
  isSuperAdmin: true,
}

const LEVEL_RANK: Record<string, number> = { none: 0, read: 1, write: 2 }

/** 테스트가 조절하는 현재 관리자의 권한. 기본은 쓰기. */
const granted = { inquiries: 'write' }
const guardCalls: [string, string][] = []

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ACTOR),
  requireAnyPermission: vi.fn(async () => ACTOR),
  requireSuperAdmin: vi.fn(async () => ACTOR),
  requirePermission: vi.fn(async (module: string, level: string) => {
    guardCalls.push([module, level])

    if ((LEVEL_RANK[granted.inquiries] ?? 0) < (LEVEL_RANK[level] ?? 0)) {
      // requirePermission 은 redirect() 로 빠져나간다. 그것은 예외를 던지는 것과 같다.
      throw new Error('NEXT_REDIRECT')
    }

    return ACTOR
  }),
}))

const audits: { action: string; after?: unknown }[] = []

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(async (_actorId: string, entry: { action: string; after?: unknown }) => {
    audits.push({ action: entry.action, after: entry.after })
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const revalidatedTags: string[][] = []

vi.mock('@/lib/revalidate', () => ({
  CLIENT_CACHE_TAGS: { inquiryCategories: 'inquiry-categories' },
  revalidateClient: vi.fn(async (tags: string[]) => {
    revalidatedTags.push(tags)

    return { ok: true }
  }),
}))

type Row = Record<string, unknown> | null

const db = {
  categoryRow: null as Row,
  inquiryCount: 0,
  writeError: null as { message: string; code?: string } | null,
  rpcResult: 0,
}

const rpcCalls: { name: string; args: Record<string, unknown> }[] = []
const updates: { table: string; payload: Record<string, unknown> }[] = []
const deletes: string[] = []
const inserts: Record<string, unknown>[] = []

vi.mock('@/lib/supabase/server', () => {
  function builder(table: string) {
    let operation: 'select' | 'insert' | 'update' | 'delete' = 'select'

    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: (payload: Record<string, unknown>) => {
        operation = 'insert'
        inserts.push(payload)

        return chain
      },
      update: (payload: Record<string, unknown>) => {
        operation = 'update'
        updates.push({ table, payload })

        return chain
      },
      delete: () => {
        operation = 'delete'
        deletes.push(table)

        return chain
      },
      eq: () => chain,
      order: () => chain,
      limit: () => chain,
      maybeSingle: async () => ({ data: db.categoryRow, error: null }),
      single: async () => ({ data: { id: CATEGORY_ID }, error: db.writeError }),
      then: (resolve: (value: unknown) => unknown) => {
        if (operation === 'select') {
          return resolve({ data: [], count: db.inquiryCount, error: null })
        }

        return resolve({ data: null, count: null, error: db.writeError })
      },
    }

    return chain
  }

  return {
    createClient: async () => ({
      from: (table: string) => builder(table),
      rpc: async (name: string, args: Record<string, unknown>) => {
        rpcCalls.push({ name, args })

        return { data: db.rpcResult, error: db.writeError }
      },
    }),
  }
})

const {
  createInquiryCategoryAction,
  deleteInquiryCategoryAction,
  reorderInquiryCategoriesAction,
  toggleInquiryCategoryAction,
  updateInquiryCategoryAction,
} = await import('@/lib/actions/inquiry-category-actions')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

const EDIT_FIELDS = {
  categoryId: CATEGORY_ID,
  label: '접속·서버',
  description: '로그인 불가',
  prefill: '닉네임:',
  isActive: 'on',
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  granted.inquiries = 'write'
  guardCalls.length = 0
  audits.length = 0
  updates.length = 0
  deletes.length = 0
  inserts.length = 0
  rpcCalls.length = 0
  revalidatedTags.length = 0
  db.categoryRow = {
    key: 'connection',
    label: '접속',
    description: null,
    prefill: '',
    sort_order: 0,
    is_active: true,
  }
  db.inquiryCount = 0
  db.writeError = null
  db.rpcResult = 0
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('권한 가드', () => {
  it('should ask for inquiries:write in every write action', async () => {
    // Arrange & Act
    await createInquiryCategoryAction(
      {},
      formData({ label: '새 분류', description: '', prefill: '' }),
    )
    await updateInquiryCategoryAction({}, formData(EDIT_FIELDS))
    await toggleInquiryCategoryAction({}, formData({ categoryId: CATEGORY_ID, isActive: 'false' }))
    await deleteInquiryCategoryAction({}, formData({ categoryId: CATEGORY_ID }))
    await reorderInquiryCategoriesAction({}, formData({ ids: CATEGORY_ID }))

    // Assert
    expect(guardCalls).toEqual([
      ['inquiries', 'write'],
      ['inquiries', 'write'],
      ['inquiries', 'write'],
      ['inquiries', 'write'],
      ['inquiries', 'write'],
    ])
  })

  it('should stop a read-only admin before touching the database', async () => {
    // Arrange
    granted.inquiries = 'read'

    // Act & Assert
    await expect(updateInquiryCategoryAction({}, formData(EDIT_FIELDS))).rejects.toThrow(
      'NEXT_REDIRECT',
    )
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('createInquiryCategoryAction', () => {
  it('should insert with an auto key and burn the client tag', async () => {
    // Arrange & Act
    const result = await createInquiryCategoryAction(
      {},
      formData({ label: 'Save Data', description: '', prefill: '닉네임:', isActive: 'on' }),
    )

    // Assert
    expect(result.message).toBe('카테고리를 등록했습니다.')
    expect(inserts[0]).toMatchObject({ key: 'save-data', label: 'Save Data', is_active: true })
    /* 설명을 비우면 null 로 저장한다 — "설명 없음"이 null · '' 두 벌이 되지 않게. */
    expect(inserts[0]?.description).toBeNull()
    expect(audits[0]?.action).toBe('inquiry_category.create')
    expect(revalidatedTags).toEqual([['inquiry-categories']])
  })

  it('should turn a duplicate label into a field error', async () => {
    // Arrange — 운영자가 스스로 고칠 수 있는 실패는 무엇이 문제인지 그대로 알린다.
    db.writeError = { message: 'duplicate key', code: '23505' }

    // Act
    const result = await createInquiryCategoryAction(
      {},
      formData({ label: '접속·서버', description: '', prefill: '' }),
    )

    // Assert
    expect(result.fieldErrors?.label).toContain('이미 같은 이름')
  })

  it('should reject an empty label without touching the database', async () => {
    // Arrange & Act
    const result = await createInquiryCategoryAction(
      {},
      formData({ label: '  ', description: '', prefill: '' }),
    )

    // Assert
    expect(result.fieldErrors?.label).toBeDefined()
    expect(inserts).toHaveLength(0)
  })
})

describe('updateInquiryCategoryAction', () => {
  it('should go through the RPC so a rename carries the old inquiries along', async () => {
    // Arrange — 이름이 바뀌면 과거 문의 3건이 새 이름으로 옮겨졌다고 가정한다.
    db.rpcResult = 3

    // Act
    const result = await updateInquiryCategoryAction({}, formData(EDIT_FIELDS))

    // Assert
    expect(rpcCalls[0]?.name).toBe('update_inquiry_category')
    expect(rpcCalls[0]?.args).toMatchObject({
      p_id: CATEGORY_ID,
      /* key 는 라벨이 바뀌어도 유지한다 — 코드가 같은 행을 계속 가리켜야 한다. */
      p_key: 'connection',
      p_label: '접속·서버',
      p_is_active: true,
    })
    expect(result.message).toContain('3건')
    expect(audits[0]?.action).toBe('inquiry_category.update')
    expect(audits[0]?.after).toMatchObject({ relabelled_inquiries: 3 })
  })

  it('should not leak the raw Postgres message', async () => {
    // Arrange
    db.writeError = { message: RAW_ERROR, code: '42501' }

    // Act
    const result = await updateInquiryCategoryAction({}, formData(EDIT_FIELDS))

    // Assert
    expect(result.formError).toBe('카테고리를 수정하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(result.formError).not.toContain('policy')
    expect(errorSpy).toHaveBeenCalled()
  })

  it('should stop when the category is gone', async () => {
    // Arrange
    db.categoryRow = null

    // Act
    const result = await updateInquiryCategoryAction({}, formData(EDIT_FIELDS))

    // Assert
    expect(result.formError).toBe('카테고리를 찾을 수 없습니다.')
    expect(rpcCalls).toHaveLength(0)
  })
})

describe('deleteInquiryCategoryAction', () => {
  it('should refuse to delete a category that inquiries still use', async () => {
    // Arrange — 지우면 그 문의들의 분류가 어디에도 정의되지 않은 문자열이 된다.
    db.inquiryCount = 4

    // Act
    const result = await deleteInquiryCategoryAction({}, formData({ categoryId: CATEGORY_ID }))

    // Assert
    expect(result.formError).toContain('4건')
    expect(result.formError).toContain('비활성화')
    expect(deletes).toHaveLength(0)
  })

  it('should delete an unused category and log it', async () => {
    // Arrange & Act
    const result = await deleteInquiryCategoryAction({}, formData({ categoryId: CATEGORY_ID }))

    // Assert
    expect(result.message).toBe('카테고리를 삭제했습니다.')
    expect(deletes).toContain('inquiry_categories')
    expect(audits[0]?.action).toBe('inquiry_category.delete')
  })
})

describe('toggleInquiryCategoryAction', () => {
  it('should hide a category from the user form', async () => {
    // Arrange & Act
    const result = await toggleInquiryCategoryAction(
      {},
      formData({ categoryId: CATEGORY_ID, isActive: 'false' }),
    )

    // Assert
    expect(updates[0]).toEqual({ table: 'inquiry_categories', payload: { is_active: false } })
    expect(result.message).toBe('카테고리를 비활성화했습니다.')
    expect(revalidatedTags).toEqual([['inquiry-categories']])
  })
})

describe('reorderInquiryCategoriesAction', () => {
  it('should renumber the ids from zero in the given order', async () => {
    // Arrange
    const second = '33333333-3333-4333-8333-333333333333'

    // Act
    const result = await reorderInquiryCategoriesAction(
      {},
      formData({ ids: `${CATEGORY_ID},${second}` }),
    )

    // Assert
    expect(updates).toEqual([
      { table: 'inquiry_categories', payload: { sort_order: 0 } },
      { table: 'inquiry_categories', payload: { sort_order: 1 } },
    ])
    expect(result.message).toBe('순서를 저장했습니다.')
    expect(audits[0]?.action).toBe('inquiry_category.reorder')
  })

  it('should refuse a malformed payload', async () => {
    // Arrange & Act
    const result = await reorderInquiryCategoriesAction({}, formData({ ids: 'nope' }))

    // Assert
    expect(result.formError).toBe('정렬 정보를 읽지 못했습니다.')
    expect(updates).toHaveLength(0)
  })
})
