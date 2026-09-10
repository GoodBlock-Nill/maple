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

vi.mock('next/cache', () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }))

/** 데이터 계층(`toAttachments`)이 `server-only` 를 끌고 온다. 테스트에서는 비운다. */
vi.mock('server-only', () => ({}))

const getCurrentUser = vi.fn()
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: () => getCurrentUser() }))

let stub: SupabaseStub
let uploads: string[]
let removed: string[][]

function storageStub() {
  return {
    from: () => ({
      upload: async (path: string) => {
        uploads.push(path)

        return { error: null }
      },
      remove: async (paths: string[]) => {
        removed.push(paths)

        return { error: null }
      },
    }),
  }
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ ...stub.client, storage: storageStub() }),
}))

/* 카테고리(와 그 카테고리의 세부 문의 유형)는 DB 에서 온다. 액션이 무엇을 허용
   목록으로 쓰는지만 보면 되므로 데이터 계층은 고정 목록으로 세운다(`server-only` 를
   끌고 오지 않는 부수 효과도 있다). */
const CATEGORIES = [
  { key: 'k0', label: '접속·서버', subtypes: ['로그인/접속 불가', '강제 종료'] },
  { key: 'k1', label: '캐릭터·게임 진행', subtypes: ['보상 획득 오류'] },
  /* 세부 유형이 없는 카테고리 — 폼이 hidden 으로 싣는 '기타' 만 받는다. */
  { key: 'k2', label: '기타·건의', subtypes: [] },
]
vi.mock('@/lib/data/inquiry-categories', () => ({
  getInquiryCategories: async () =>
    CATEGORIES.map((category) => ({ ...category, description: null, prefill: '' })),
  getInquiryCategoryLabels: async () => CATEGORIES.map((category) => category.label),
}))

const { cancelInquiry, updateInquiry } = await import('@/lib/actions/inquiry-edit-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

const USER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', nickname: '모험가', role: 'user' }
const INQUIRY_ID = '33333333-0000-4000-8000-000000000001'
const DETAIL_PATH = `/support/inquiries/${INQUIRY_ID}`
const CREATED_AT = '2026-09-08T01:00:00.000Z'

const ATTACHMENT = {
  name: 'shot.png',
  path: `${USER.id}/shot.png`,
  size: 1024,
  mimeType: 'image/png',
}

/** 접수 직후의 행(한 번도 수정하지 않아 updated_at 이 created_at 과 같다). */
function ownedRow(overrides: Record<string, unknown> = {}) {
  return {
    status: 'pending',
    cancelled_at: null,
    attachments: [ATTACHMENT],
    /* 접수 당시의 분류·유형. 지금 목록에 없어도 수정은 통과해야 한다. */
    category: '접속·서버',
    type: '로그인/접속 불가',
    created_at: CREATED_AT,
    updated_at: CREATED_AT,
    ...overrides,
  }
}

function editForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData()
  const values = {
    accountId: '20123456789000000',
    category: '캐릭터·게임 진행',
    type: '보상 획득 오류',
    title: '제목을 고쳤습니다',
    content: '내용도 함께 고쳤습니다.',
    ...overrides,
  }

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

/** 액션의 성공 경로는 redirect 예외로 끝난다. 그 주소를 꺼낸다. */
async function runAndCatch(promise: Promise<unknown>): Promise<string> {
  const thrown = await promise.catch((error: Error) => error)

  return thrown instanceof Error ? thrown.message : ''
}

beforeEach(() => {
  getCurrentUser.mockReset()
  getCurrentUser.mockResolvedValue(USER)
  uploads = []
  removed = []
  /* 1) 소유 문의 조회 2) update 결과 */
  stub = createSupabaseStub([
    { data: ownedRow(), error: null },
    { data: null, error: null },
  ])
})

describe('updateInquiry', () => {
  it('should save the edited fields and send the owner back to the detail page', async () => {
    // Arrange & Act
    const message = await runAndCatch(updateInquiry(INQUIRY_ID, EMPTY_FORM_STATE, editForm()))

    // Assert
    expect(stub.updates[0]).toMatchObject({
      account_id: '20123456789000000',
      category: '캐릭터·게임 진행',
      type: '보상 획득 오류',
      title: '제목을 고쳤습니다',
      content: '내용도 함께 고쳤습니다.',
      attachments: [ATTACHMENT],
    })
    expect(message).toBe(`${REDIRECT_PREFIX}${DETAIL_PATH}?updated=1`)
  })

  it('should keep the type the inquiry was filed with', async () => {
    // Arrange — 옛 3종('문의')으로 접수된 문의. 지금은 어느 카테고리에도 없는 값이다.
    stub = createSupabaseStub([
      { data: ownedRow({ type: '문의' }), error: null },
      { data: null, error: null },
    ])

    // Act — 제목만 고치고 유형은 그대로 둔다.
    await runAndCatch(
      updateInquiry(
        INQUIRY_ID,
        EMPTY_FORM_STATE,
        editForm({ category: '접속·서버', type: '문의' }),
      ),
    )

    // Assert
    expect(stub.updates[0]).toMatchObject({ category: '접속·서버', type: '문의' })
  })

  it('should reject a subtype from another category', async () => {
    // Arrange & Act — 예외는 이 문의가 들고 있던 값 하나뿐이다.
    const result = await updateInquiry(
      INQUIRY_ID,
      EMPTY_FORM_STATE,
      editForm({ category: '접속·서버', type: '보상 획득 오류' }),
    )

    // Assert
    expect(result.fieldErrors?.type).toContain('세부 문의 유형')
    expect(stub.updates).toHaveLength(0)
  })

  it('should refuse to edit an inquiry the operator already picked up', async () => {
    // Arrange — 처리 중부터는 본문이 바뀌면 답변의 근거가 사라진다.
    stub = createSupabaseStub([{ data: ownedRow({ status: 'in_progress' }), error: null }])

    // Act
    const result = await updateInquiry(INQUIRY_ID, EMPTY_FORM_STATE, editForm())

    // Assert
    expect(result.formError).toContain('접수 대기')
    expect(stub.updates).toHaveLength(0)
  })

  it('should refuse to edit an inquiry the owner already cancelled', async () => {
    // Arrange
    stub = createSupabaseStub([
      { data: ownedRow({ cancelled_at: '2026-09-08T02:00:00.000Z' }), error: null },
    ])

    // Act
    const result = await updateInquiry(INQUIRY_ID, EMPTY_FORM_STATE, editForm())

    // Assert
    expect(result.formError).toContain('접수 대기')
    expect(stub.updates).toHaveLength(0)
  })

  it('should drop the attachments ticked for removal and delete them after the row is saved', async () => {
    // Arrange
    const formData = editForm()
    formData.append('removeAttachments', ATTACHMENT.path)

    // Act
    await runAndCatch(updateInquiry(INQUIRY_ID, EMPTY_FORM_STATE, formData))

    // Assert — 저장이 끝난 뒤에 지운다. 먼저 지우면 실패 시 첨부만 사라진다.
    expect(stub.updates[0]).toMatchObject({ attachments: [] })
    expect(removed[0]).toEqual([ATTACHMENT.path])
  })

  it('should keep the three file limit across kept and newly added attachments', async () => {
    // Arrange — 기존 3개를 그대로 두고 한 개 더 올리려는 시도.
    stub = createSupabaseStub([
      { data: ownedRow({ attachments: [ATTACHMENT, ATTACHMENT, ATTACHMENT] }), error: null },
    ])
    const formData = editForm()
    formData.append('attachments', new File(['png'], 'more.png', { type: 'image/png' }))

    // Act
    const result = await updateInquiry(INQUIRY_ID, EMPTY_FORM_STATE, formData)

    // Assert
    expect(result.fieldErrors?.attachments).toContain('최대 3개')
    expect(uploads).toHaveLength(0)
  })

  it('should explain the lock when the DB guard rejects the update', async () => {
    // Arrange — 폼을 여는 사이 운영자가 처리를 시작하면 가드가 42501 로 거절한다.
    stub = createSupabaseStub([
      { data: ownedRow(), error: null },
      { data: null, error: { code: '42501', message: 'guard' } },
    ])

    // Act
    const result = await updateInquiry(INQUIRY_ID, EMPTY_FORM_STATE, editForm())

    // Assert
    expect(result.formError).toContain('접수 대기')
  })

  it('should not touch the row when the id is not a uuid', async () => {
    // Arrange & Act — uuid 가 아닌 id 로 조회하면 postgres 가 22P02 를 던진다.
    const result = await updateInquiry('not-a-uuid', EMPTY_FORM_STATE, editForm())

    // Assert
    expect(result.formError).toContain('찾을 수 없습니다')
    expect(stub.tables).toHaveLength(0)
  })

  it('should require a session', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(null)

    // Act
    const result = await updateInquiry(INQUIRY_ID, EMPTY_FORM_STATE, editForm())

    // Assert
    expect(result.formError).toContain('로그인')
    expect(stub.updates).toHaveLength(0)
  })
})

describe('cancelInquiry', () => {
  it('should close the inquiry and stamp cancelled_at in the same update', async () => {
    // Arrange & Act — 가드는 두 값을 한 묶음으로만 허용한다.
    const message = await runAndCatch(cancelInquiry(INQUIRY_ID, EMPTY_FORM_STATE))
    const payload = stub.updates[0] as { status: string; cancelled_at: string }

    // Assert
    expect(payload.status).toBe('closed')
    expect(Number.isNaN(new Date(payload.cancelled_at).getTime())).toBe(false)
    expect(message).toBe(`${REDIRECT_PREFIX}${DETAIL_PATH}?cancelled=1`)
  })

  it('should cancel an inquiry that is already being handled', async () => {
    // Arrange — 처리 중에도 취소는 열려 있다(수정만 막힌다).
    stub = createSupabaseStub([
      { data: ownedRow({ status: 'in_progress' }), error: null },
      { data: null, error: null },
    ])

    // Act
    await runAndCatch(cancelInquiry(INQUIRY_ID, EMPTY_FORM_STATE))

    // Assert
    expect(stub.updates[0]).toMatchObject({ status: 'closed' })
  })

  it('should refuse to cancel an answered inquiry', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: ownedRow({ status: 'answered' }), error: null }])

    // Act
    const result = await cancelInquiry(INQUIRY_ID, EMPTY_FORM_STATE)

    // Assert
    expect(result.formError).toContain('취소할 수 있습니다')
    expect(stub.updates).toHaveLength(0)
  })

  it('should refuse to cancel twice', async () => {
    // Arrange — 되돌리기가 없으므로 두 번째 취소는 의미가 없다.
    stub = createSupabaseStub([
      {
        data: ownedRow({ cancelled_at: '2026-09-08T02:00:00.000Z', status: 'closed' }),
        error: null,
      },
    ])

    // Act
    const result = await cancelInquiry(INQUIRY_ID, EMPTY_FORM_STATE)

    // Assert
    expect(result.formError).toContain('취소할 수 있습니다')
    expect(stub.updates).toHaveLength(0)
  })

  it('should report a missing inquiry instead of pretending it worked', async () => {
    // Arrange — 남의 문의 id 는 user_id 조건에서 0건으로 떨어진다.
    stub = createSupabaseStub([{ data: null, error: null }])

    // Act
    const result = await cancelInquiry(INQUIRY_ID, EMPTY_FORM_STATE)

    // Assert
    expect(result.formError).toContain('찾을 수 없습니다')
    expect(stub.updates).toHaveLength(0)
  })
})
