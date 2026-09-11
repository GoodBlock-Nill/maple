import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 운영자 전용 내부 메모.
 *
 * 고정하려는 것은 넷이다.
 *   1. 쓰기 권한이 없으면 아무것도 저장되지 않는다(직접 POST 방어).
 *   2. 작성 시점의 닉네임을 함께 박는다 — 계정이 사라져도 누구의 판단인지 남아야 한다.
 *   3. 감사 로그에 **본문을 남기지 않는다.** 메모를 지워도 사본이 남으면 지운 뜻이 사라진다.
 *   4. 남의 메모는 지울 수 없다(RLS 와 같은 규칙을 액션이 먼저 읽어 문구로 알려 준다).
 */

const ADMIN_ID = '11111111-1111-4111-8111-111111111111'
const OTHER_ADMIN_ID = '22222222-2222-4222-8222-222222222222'
const INQUIRY_ID = '33333333-3333-4333-8333-333333333333'
const NOTE_ID = '44444444-4444-4444-8444-444444444444'

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
      throw new Error('NEXT_REDIRECT')
    }

    return ACTOR
  }),
}))

const audits: { action: string; before?: unknown; after?: unknown }[] = []

vi.mock('@/lib/audit', () => ({
  writeAuditLog: vi.fn(async (_actorId: string, entry: Record<string, unknown>) => {
    audits.push(entry as { action: string })
  }),
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const db = vi.hoisted(() => ({
  note: null as Record<string, unknown> | null,
  inserts: [] as Record<string, unknown>[],
  deletes: [] as string[],
}))

vi.mock('@/lib/supabase/server', () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {
      select: () => chain,
      eq: () => chain,
      insert: (payload: Record<string, unknown>) => {
        db.inserts.push(payload)

        return chain
      },
      delete: () => {
        db.deletes.push(table)

        return chain
      },
      maybeSingle: async () => ({ data: db.note, error: null }),
      single: async () => ({ data: { id: NOTE_ID }, error: null }),
      then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
    }

    return chain
  }

  return { createClient: async () => ({ from: (table: string) => builder(table) }) }
})

const { createInquiryNoteAction, deleteInquiryNoteAction } =
  await import('@/lib/actions/inquiry-note-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')
const { INQUIRY_NOTE_MAX_LENGTH } = await import('@/lib/validation/inquiry-assignment')

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  granted.inquiries = 'write'
  guardCalls.length = 0
  audits.length = 0
  db.note = { author_id: ADMIN_ID }
  db.inserts = []
  db.deletes = []
})

afterEach(() => {
  errorSpy.mockRestore()
})

describe('createInquiryNoteAction', () => {
  it('should require inquiries write', async () => {
    // Arrange
    granted.inquiries = 'read'

    // Act & Assert
    await expect(
      createInquiryNoteAction(EMPTY_FORM_STATE, formData({ inquiryId: INQUIRY_ID, body: '메모' })),
    ).rejects.toThrow('NEXT_REDIRECT')
    expect(db.inserts).toHaveLength(0)
  })

  it('should store the author nickname as it was at the time', async () => {
    // Arrange & Act
    const state = await createInquiryNoteAction(
      EMPTY_FORM_STATE,
      formData({ inquiryId: INQUIRY_ID, body: '결제 로그 확인함.' }),
    )

    // Assert — author_id 는 탈퇴하면 null 이 된다. 표시 이름은 그때도 남아야 한다.
    expect(db.inserts[0]).toMatchObject({
      inquiry_id: INQUIRY_ID,
      author_id: ADMIN_ID,
      author_nickname_snapshot: '운영자',
      body: '결제 로그 확인함.',
    })
    expect(state.message).toBe('내부 메모를 남겼습니다.')
  })

  it('should not copy the note body into the audit log', async () => {
    // Arrange & Act
    await createInquiryNoteAction(
      EMPTY_FORM_STATE,
      formData({ inquiryId: INQUIRY_ID, body: '환불 기준 확인 필요' }),
    )

    // Assert — 메모를 지워도 감사 로그에 사본이 남으면 지운 뜻이 사라진다.
    expect(audits).toEqual([
      expect.objectContaining({
        action: 'inquiry_note.create',
        after: { inquiry_id: INQUIRY_ID, length: '환불 기준 확인 필요'.length },
      }),
    ])
  })

  it('should reject an empty body with a field error', async () => {
    // Arrange & Act
    const state = await createInquiryNoteAction(
      EMPTY_FORM_STATE,
      formData({ inquiryId: INQUIRY_ID, body: '   ' }),
    )

    // Assert
    expect(state.fieldErrors?.body).toBe('메모 내용을 입력해 주세요.')
    expect(db.inserts).toHaveLength(0)
  })

  it('should cap the body at the reply limit', async () => {
    // Arrange & Act — 답변과 같은 2000자다. 메모만 관대하면 옮겨 적을 수 없는 글이 쌓인다.
    const state = await createInquiryNoteAction(
      EMPTY_FORM_STATE,
      formData({ inquiryId: INQUIRY_ID, body: '가'.repeat(INQUIRY_NOTE_MAX_LENGTH + 1) }),
    )

    // Assert
    expect(state.fieldErrors?.body).toBe(`메모는 ${INQUIRY_NOTE_MAX_LENGTH}자를 넘을 수 없습니다.`)
    expect(db.inserts).toHaveLength(0)
  })
})

describe('deleteInquiryNoteAction', () => {
  it('should delete my own note', async () => {
    // Arrange & Act
    const state = await deleteInquiryNoteAction(
      EMPTY_FORM_STATE,
      formData({ noteId: NOTE_ID, inquiryId: INQUIRY_ID }),
    )

    // Assert
    expect(db.deletes).toEqual(['inquiry_notes'])
    expect(audits.map((entry) => entry.action)).toEqual(['inquiry_note.delete'])
    expect(state.message).toBe('내부 메모를 지웠습니다.')
  })

  it('should refuse someone else note and say why', async () => {
    // Arrange
    db.note = { author_id: OTHER_ADMIN_ID }

    // Act
    const state = await deleteInquiryNoteAction(
      EMPTY_FORM_STATE,
      formData({ noteId: NOTE_ID, inquiryId: INQUIRY_ID }),
    )

    /* Assert — RLS 도 같은 규칙을 강제하지만, 정책이 막으면 "0건 삭제"가 조용한
       성공으로 보인다. 운영자에게는 이유를 말해 줘야 한다. */
    expect(state.formError).toBe('내가 남긴 메모만 지울 수 있습니다.')
    expect(db.deletes).toHaveLength(0)
  })

  it('should report a note that is already gone', async () => {
    // Arrange
    db.note = null

    // Act
    const state = await deleteInquiryNoteAction(
      EMPTY_FORM_STATE,
      formData({ noteId: NOTE_ID, inquiryId: INQUIRY_ID }),
    )

    // Assert
    expect(state.formError).toBe('메모를 찾을 수 없습니다. 목록을 새로고침해 주세요.')
    expect(db.deletes).toHaveLength(0)
  })
})
