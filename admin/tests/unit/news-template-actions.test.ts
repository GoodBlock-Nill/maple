import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 카테고리 템플릿 쓰기 액션의 가드.
 *
 * 확인하는 것은 다섯이다.
 *   1. 두 액션 모두 스스로 `requirePermission('news', 'write')` 를 부른다 — 서버 액션은
 *      UI 를 거치지 않는 직접 POST 로도 호출된다.
 *   2. 본문은 뉴스 본문과 **같은 정제기**를 통과한다. 템플릿이 더 관대하면 불러온 서식이
 *      글 저장에서 사라진다.
 *   3. 되돌리기는 코드 시드를 **그대로** 심는다(마이그레이션 시드와 같은 문자열).
 *   4. 감사 로그에 before/after 가 남는다 — 덮어쓰기 전 문안을 되짚을 유일한 근거다.
 *   5. 사용자 사이트 캐시는 태우지 않는다. 사용자 사이트는 이 테이블을 읽지 못한다.
 */

/* 정제기는 이미지 허용 접두사를 환경 변수에서 읽는다(액션이 옵션 없이 부른다). */
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const TEMPLATE_ID = '22222222-2222-4222-8222-222222222222'
const RAW_ERROR = 'permission denied for table news_category_templates (policy "…_admin_all")'

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

const LEVEL_RANK: Record<string, number> = { none: 0, read: 1, write: 2 }

/** 테스트가 조절하는 현재 관리자의 뉴스 권한. 기본은 쓰기. */
const granted = { news: 'write' }
const guardCalls: [string, string][] = []

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ACTOR),
  requireAnyPermission: vi.fn(async () => ACTOR),
  requireSuperAdmin: vi.fn(async () => ACTOR),
  requirePermission: vi.fn(async (module: string, level: string) => {
    guardCalls.push([module, level])

    if ((LEVEL_RANK[granted.news] ?? 0) < (LEVEL_RANK[level] ?? 0)) {
      // requirePermission 은 redirect() 로 빠져나간다 — 예외를 던지는 것과 같다.
      throw new Error('NEXT_REDIRECT')
    }

    return ACTOR
  }),
}))

const audits: { action: string; before?: unknown; after?: unknown; targetTable?: string }[] = []

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(
    async (
      _actorId: string,
      entry: { action: string; before?: unknown; after?: unknown; targetTable?: string },
    ) => {
      audits.push(entry)
    },
  ),
}))

const revalidatedPaths: string[] = []

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn((path: string) => {
    revalidatedPaths.push(path)
  }),
}))

const clientRevalidations: string[][] = []

vi.mock('@/lib/revalidate', () => ({
  CLIENT_CACHE_TAGS: { newsList: 'news-list' },
  revalidateClient: vi.fn(async (tags: string[]) => {
    clientRevalidations.push(tags)

    return { ok: true }
  }),
}))

const db = {
  row: null as Record<string, unknown> | null,
  writeError: null as { message: string; code?: string } | null,
}

const upserts: { payload: Record<string, unknown>; options: unknown }[] = []

vi.mock('@/lib/supabase/server', () => {
  function builder() {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      upsert: (payload: Record<string, unknown>, options: unknown) => {
        upserts.push({ payload, options })

        return chain
      },
      maybeSingle: async () => ({ data: db.row, error: null }),
      single: async () => ({
        data: db.writeError === null ? { id: TEMPLATE_ID } : null,
        error: db.writeError,
      }),
    }

    return chain
  }

  return { createClient: async () => ({ from: () => builder() }) }
})

const { resetNewsTemplateAction, saveNewsTemplateAction } =
  await import('@/lib/actions/news-template-actions')
const { NEWS_TEMPLATE_SEEDS } = await import('@/lib/constants/news-templates')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

const SAVE_FIELDS = {
  category: 'maintenance',
  title: '[점검] 10월 정기 점검',
  summary: '10월 점검 안내',
  body: '<h3>점검 일시</h3><p>10월 1일</p>',
  isActive: 'on',
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  granted.news = 'write'
  guardCalls.length = 0
  audits.length = 0
  upserts.length = 0
  revalidatedPaths.length = 0
  clientRevalidations.length = 0
  db.row = {
    id: TEMPLATE_ID,
    title_template: '[점검] 옛 제목',
    summary_template: '',
    body_template: '<p>옛 본문</p>',
    is_active: true,
  }
  db.writeError = null
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('권한 가드', () => {
  it('should ask for news:write in every write action', async () => {
    // Arrange & Act
    await saveNewsTemplateAction({}, formData(SAVE_FIELDS))
    await resetNewsTemplateAction({}, formData({ category: 'maintenance' }))

    // Assert
    expect(guardCalls).toEqual([
      ['news', 'write'],
      ['news', 'write'],
    ])
  })

  it('should stop a read-only admin before touching the database', async () => {
    // Arrange
    granted.news = 'read'

    // Act & Assert
    await expect(saveNewsTemplateAction({}, formData(SAVE_FIELDS))).rejects.toThrow('NEXT_REDIRECT')
    await expect(
      resetNewsTemplateAction({}, formData({ category: 'maintenance' })),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(upserts).toHaveLength(0)
  })
})

describe('saveNewsTemplateAction', () => {
  it('should upsert one row per category and log the change', async () => {
    // Arrange & Act
    const result = await saveNewsTemplateAction({}, formData(SAVE_FIELDS))

    // Assert
    expect(result.message).toContain('점검안내')
    expect(upserts[0]?.payload).toMatchObject({
      category_key: 'maintenance',
      title_template: SAVE_FIELDS.title,
      summary_template: SAVE_FIELDS.summary,
      body_template: SAVE_FIELDS.body,
      is_active: true,
      updated_by: ADMIN_ID,
    })
    // 카테고리당 한 행이라는 규칙이 여기서 강제된다.
    expect(upserts[0]?.options).toEqual({ onConflict: 'category_key' })
    expect(audits[0]).toMatchObject({
      action: 'news_template.update',
      targetTable: 'news_category_templates',
    })
    expect(audits[0]?.before).toMatchObject({ title_template: '[점검] 옛 제목' })
  })

  it('should store an unchecked switch as off', async () => {
    // Arrange & Act — 체크박스는 켜졌을 때만 전송된다.
    const { isActive: _omitted, ...withoutSwitch } = SAVE_FIELDS

    await saveNewsTemplateAction({}, formData(withoutSwitch))

    // Assert
    expect(upserts[0]?.payload).toMatchObject({ is_active: false })
  })

  it('should sanitize the body with the same allow-list as news posts', async () => {
    // Arrange & Act
    await saveNewsTemplateAction(
      {},
      formData({ ...SAVE_FIELDS, body: '<p>본문</p><script>alert(1)</script>' }),
    )

    // Assert — 허용 목록 밖 태그는 저장 전에 사라진다.
    expect(upserts[0]?.payload.body_template).toBe('<p>본문</p>')
  })

  it('should refuse a body that is nothing but disallowed markup', async () => {
    // Arrange & Act — 그대로 두면 "본문을 넣었는데 템플릿이 비어 있다"가 된다.
    const result = await saveNewsTemplateAction(
      {},
      formData({ ...SAVE_FIELDS, body: '<script>alert(1)</script>' }),
    )

    // Assert
    expect(result.fieldErrors?.body).toBe('저장할 수 있는 본문이 없습니다.')
    expect(upserts).toHaveLength(0)
  })

  it('should reject an over-long title before touching the database', async () => {
    // Arrange & Act
    const result = await saveNewsTemplateAction(
      {},
      formData({ ...SAVE_FIELDS, title: 'ㄱ'.repeat(101) }),
    )

    // Assert
    expect(result.fieldErrors?.title).toContain('100자')
    expect(upserts).toHaveLength(0)
  })

  it('should not leak the raw Postgres message', async () => {
    // Arrange
    db.writeError = { message: RAW_ERROR, code: '42501' }

    // Act
    const result = await saveNewsTemplateAction({}, formData(SAVE_FIELDS))

    // Assert
    expect(result.formError).toBe('템플릿을 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(result.formError).not.toContain('policy')
    expect(errorSpy).toHaveBeenCalled()
    expect(audits).toHaveLength(0)
  })

  it('should refresh the admin screens that read the template', async () => {
    // Arrange & Act
    await saveNewsTemplateAction({}, formData(SAVE_FIELDS))

    // Assert — 새 글 화면이 템플릿을 서버에서 싣기 때문에 함께 비운다.
    expect(revalidatedPaths).toContain('/news/templates')
    expect(revalidatedPaths).toContain('/news/new')
  })

  it('should not burn any client site cache tag', async () => {
    // Arrange & Act — 사용자 사이트는 이 테이블을 읽지 못한다(RLS 가 관리자만 연다).
    await saveNewsTemplateAction({}, formData(SAVE_FIELDS))

    // Assert
    expect(clientRevalidations).toHaveLength(0)
  })
})

describe('resetNewsTemplateAction', () => {
  it('should restore the seed word for word', async () => {
    // Arrange
    const seed = NEWS_TEMPLATE_SEEDS.patch

    // Act
    const result = await resetNewsTemplateAction({}, formData({ category: 'patch' }))

    // Assert — 마이그레이션 시드와 같은 문자열이라 첫 배포 상태와 정확히 같아진다.
    expect(upserts[0]?.payload).toMatchObject({
      category_key: 'patch',
      title_template: seed.title,
      summary_template: seed.summary,
      body_template: seed.body,
    })
    expect(result.message).toContain('패치노트')
    expect(audits[0]?.action).toBe('news_template.reset')
    expect(audits[0]?.before).toMatchObject({ title_template: '[점검] 옛 제목' })
  })

  it('should keep the on/off switch as it was', async () => {
    // Arrange — 문구를 되돌렸다고 꺼 둔 템플릿이 되살아나면 안 된다.
    db.row = { ...(db.row ?? {}), is_active: false }

    // Act
    await resetNewsTemplateAction({}, formData({ category: 'patch' }))

    // Assert
    expect(upserts[0]?.payload).toMatchObject({ is_active: false })
  })

  it('should default a never-saved category to on', async () => {
    // Arrange — 시드 이후에 추가된 카테고리는 행이 없다.
    db.row = null

    // Act
    await resetNewsTemplateAction({}, formData({ category: 'event' }))

    // Assert
    expect(upserts[0]?.payload).toMatchObject({ is_active: true })
    expect(audits[0]?.before).toBeNull()
  })

  it('should refuse an unknown category', async () => {
    // Arrange & Act
    const result = await resetNewsTemplateAction({}, formData({ category: 'nope' }))

    // Assert
    expect(result.formError).toBe('카테고리를 찾을 수 없습니다.')
    expect(upserts).toHaveLength(0)
  })

  it('should not leak the raw Postgres message', async () => {
    // Arrange
    db.writeError = { message: RAW_ERROR, code: '42501' }

    // Act
    const result = await resetNewsTemplateAction({}, formData({ category: 'patch' }))

    // Assert
    expect(result.formError).toBe('기본값으로 되돌리지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(result.formError).not.toContain('policy')
  })
})
