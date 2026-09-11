import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 답변 템플릿 쓰기 액션의 가드.
 *
 * 확인하는 것은 넷이다.
 *   1. 모든 액션이 스스로 `requirePermission('inquiries', 'write')` 를 부른다 —
 *      서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출된다.
 *   2. '공통'은 `category_id: null` 로 저장된다. 사라진 카테고리를 가리키면(23503)
 *      운영자가 고칠 수 있는 문구로 돌려준다.
 *   3. 카테고리를 옮기면 순서는 **옮겨 간 묶음의 맨 뒤**로 다시 잡는다.
 *   4. 모든 변경이 감사 로그를 남긴다(무엇이 언제 바뀌었는지가 유일한 근거다).
 */

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222'
const CATEGORY_ID = '33333333-3333-4333-8333-333333333333'
const OTHER_CATEGORY_ID = '44444444-4444-4444-8444-444444444444'

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

const audits: { action: string; before?: unknown; after?: unknown }[] = []

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(
    async (_actorId: string, entry: { action: string; before?: unknown; after?: unknown }) => {
      audits.push({ action: entry.action, before: entry.before, after: entry.after })
    },
  ),
}))

const revalidated: string[] = []

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn((path: string) => {
    revalidated.push(path)
  }),
}))

type Row = Record<string, unknown> | null

const db = {
  templateRow: null as Row,
  /** `getNextInquiryReplyTemplateSortOrder()` 가 읽는 마지막 순번. */
  tailRow: null as Row,
  writeError: null as { message: string; code?: string } | null,
}

const updates: Record<string, unknown>[] = []
const inserts: Record<string, unknown>[] = []
const deletes: string[] = []

vi.mock('@/lib/supabase/server', () => {
  function builder(table: string) {
    let operation: 'select' | 'insert' | 'update' | 'delete' = 'select'
    /* 순번 조회만 limit(1) 을 건다. 같은 maybeSingle() 로 두 질의가 오므로
       그것으로 어느 행을 돌려줄지 가른다. */
    let isTailLookup = false

    const chain: Record<string, unknown> = {
      select: () => chain,
      insert: (payload: Record<string, unknown>) => {
        operation = 'insert'
        inserts.push(payload)

        return chain
      },
      update: (payload: Record<string, unknown>) => {
        operation = 'update'
        updates.push(payload)

        return chain
      },
      delete: () => {
        operation = 'delete'
        deletes.push(table)

        return chain
      },
      eq: () => chain,
      is: () => chain,
      or: () => chain,
      order: () => chain,
      limit: () => {
        isTailLookup = true

        return chain
      },
      maybeSingle: async () => ({
        data: isTailLookup ? db.tailRow : db.templateRow,
        error: null,
      }),
      single: async () => ({ data: { id: TEMPLATE_ID }, error: db.writeError }),
      then: (resolve: (value: unknown) => unknown) => {
        if (operation === 'select') {
          return resolve({ data: [], error: null })
        }

        return resolve({ data: null, error: db.writeError })
      },
    }

    return chain
  }

  return { createClient: async () => ({ from: (table: string) => builder(table) }) }
})

const {
  createInquiryReplyTemplateAction,
  deleteInquiryReplyTemplateAction,
  reorderInquiryReplyTemplatesAction,
  toggleInquiryReplyTemplateAction,
  updateInquiryReplyTemplateAction,
} = await import('@/lib/actions/inquiry-reply-template-actions')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

const CREATE_FIELDS = {
  categoryId: '',
  name: '접수 확인 안내',
  body: '안녕하세요, {{닉네임}}님.',
  isActive: 'on',
}

const EDIT_FIELDS = { ...CREATE_FIELDS, templateId: TEMPLATE_ID, categoryId: CATEGORY_ID }

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  granted.inquiries = 'write'
  guardCalls.length = 0
  audits.length = 0
  updates.length = 0
  inserts.length = 0
  deletes.length = 0
  revalidated.length = 0
  db.templateRow = {
    category_id: CATEGORY_ID,
    name: '접수 확인 안내',
    body: '이전 문안',
    sort_order: 1,
    is_active: true,
  }
  db.tailRow = { sort_order: 2 }
  db.writeError = null
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('권한 가드', () => {
  it('should ask for inquiries:write in every write action', async () => {
    // Arrange & Act
    await createInquiryReplyTemplateAction({}, formData(CREATE_FIELDS))
    await updateInquiryReplyTemplateAction({}, formData(EDIT_FIELDS))
    await toggleInquiryReplyTemplateAction(
      {},
      formData({ templateId: TEMPLATE_ID, isActive: 'false' }),
    )
    await deleteInquiryReplyTemplateAction({}, formData({ templateId: TEMPLATE_ID }))
    await reorderInquiryReplyTemplatesAction({}, formData({ ids: TEMPLATE_ID }))

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
    await expect(createInquiryReplyTemplateAction({}, formData(CREATE_FIELDS))).rejects.toThrow(
      'NEXT_REDIRECT',
    )
    expect(inserts).toHaveLength(0)
  })
})

describe('createInquiryReplyTemplateAction', () => {
  it('should store 공통 as a null category at the tail of the group', async () => {
    // Arrange & Act
    const result = await createInquiryReplyTemplateAction({}, formData(CREATE_FIELDS))

    // Assert
    expect(result.message).toBe('템플릿을 등록했습니다.')
    expect(inserts[0]).toMatchObject({
      category_id: null,
      name: '접수 확인 안내',
      sort_order: 3,
      is_active: true,
      created_by: ADMIN_ID,
      updated_by: ADMIN_ID,
    })
    expect(audits[0]?.action).toBe('inquiry_reply_template.create')
    expect(revalidated).toContain('/inquiries/reply-templates')
  })

  it('should turn a duplicate name into a field error', async () => {
    // Arrange — 운영자가 스스로 고칠 수 있는 실패는 무엇이 문제인지 그대로 알린다.
    db.writeError = { message: 'duplicate key', code: '23505' }

    // Act
    const result = await createInquiryReplyTemplateAction({}, formData(CREATE_FIELDS))

    // Assert
    expect(result.fieldErrors?.name).toContain('같은 이름')
  })

  it('should report a vanished category from the foreign key violation', async () => {
    // Arrange — 다이얼로그를 열어 둔 사이 카테고리가 지워진 경우.
    db.writeError = { message: 'insert violates foreign key', code: '23503' }

    // Act
    const result = await createInquiryReplyTemplateAction(
      {},
      formData({ ...CREATE_FIELDS, categoryId: CATEGORY_ID }),
    )

    // Assert
    expect(result.fieldErrors?.categoryId).toContain('새로고침')
  })

  it('should reject an empty body without touching the database', async () => {
    // Arrange & Act
    const result = await createInquiryReplyTemplateAction(
      {},
      formData({ ...CREATE_FIELDS, body: '   ' }),
    )

    // Assert
    expect(result.fieldErrors?.body).toBeDefined()
    expect(inserts).toHaveLength(0)
  })
})

describe('updateInquiryReplyTemplateAction', () => {
  it('should keep the sort order while the category stays the same', async () => {
    // Arrange & Act
    const result = await updateInquiryReplyTemplateAction({}, formData(EDIT_FIELDS))

    // Assert
    expect(result.message).toBe('템플릿을 수정했습니다.')
    expect(updates[0]).toMatchObject({ category_id: CATEGORY_ID, sort_order: 1 })
    expect(audits[0]?.action).toBe('inquiry_reply_template.update')
    expect(audits[0]?.before).toMatchObject({ body: '이전 문안' })
  })

  it('should move a template to the tail of its new group', async () => {
    // Arrange — 다른 카테고리로 옮기면 옛 순번이 새 묶음에서 겹친다.
    const result = await updateInquiryReplyTemplateAction(
      {},
      formData({ ...EDIT_FIELDS, categoryId: OTHER_CATEGORY_ID }),
    )

    // Assert
    expect(result.message).toBe('템플릿을 수정했습니다.')
    expect(updates[0]).toMatchObject({ category_id: OTHER_CATEGORY_ID, sort_order: 3 })
  })

  it('should refuse a template that is already gone', async () => {
    // Arrange
    db.templateRow = null

    // Act
    const result = await updateInquiryReplyTemplateAction({}, formData(EDIT_FIELDS))

    // Assert
    expect(result.formError).toBe('템플릿을 찾을 수 없습니다.')
    expect(updates).toHaveLength(0)
  })
})

describe('나머지 액션', () => {
  it('should log the previous body when a template is deleted', async () => {
    // Arrange & Act
    const result = await deleteInquiryReplyTemplateAction({}, formData({ templateId: TEMPLATE_ID }))

    // Assert
    expect(result.message).toBe('템플릿을 삭제했습니다.')
    expect(deletes).toEqual(['inquiry_reply_templates'])
    expect(audits[0]?.action).toBe('inquiry_reply_template.delete')
    expect(audits[0]?.before).toMatchObject({ body: '이전 문안' })
  })

  it('should toggle usage and say which way it went', async () => {
    // Arrange & Act
    const result = await toggleInquiryReplyTemplateAction(
      {},
      formData({ templateId: TEMPLATE_ID, isActive: 'false' }),
    )

    // Assert
    expect(result.message).toBe('템플릿을 껐습니다.')
    expect(updates[0]).toMatchObject({ is_active: false, updated_by: ADMIN_ID })
    expect(audits[0]?.after).toMatchObject({ is_active: false })
  })

  it('should rewrite the order as 0..n-1 in the order the screen showed', async () => {
    // Arrange
    const ids = [TEMPLATE_ID, CATEGORY_ID, OTHER_CATEGORY_ID]

    // Act
    const result = await reorderInquiryReplyTemplatesAction({}, formData({ ids: ids.join(',') }))

    // Assert
    expect(result.message).toBe('순서를 저장했습니다.')
    expect(updates.map((update) => update.sort_order)).toEqual([0, 1, 2])
    expect(audits[0]?.action).toBe('inquiry_reply_template.reorder')
    expect(audits[0]?.after).toMatchObject({ ids })
  })

  it('should say that a failed reorder may be half-applied', async () => {
    // Arrange
    db.writeError = { message: 'permission denied', code: '42501' }

    // Act
    const result = await reorderInquiryReplyTemplatesAction({}, formData({ ids: TEMPLATE_ID }))

    // Assert
    expect(result.formError).toContain('일부만 반영')
    expect(audits).toHaveLength(0)
  })
})
