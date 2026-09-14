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

/** 영상 확정 경로가 서비스 롤 클라이언트(`server-only`)를 끌고 온다. 테스트에서는 비운다. */
vi.mock('server-only', () => ({}))

const getCurrentUser = vi.fn()
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: () => getCurrentUser() }))

type StorageCall = { path: string; contentType: string }

let stub: SupabaseStub
let uploads: StorageCall[]
let removed: string[][]
let uploadError: { message: string } | null

/** 스토리지는 스텁에 없으므로 여기서 최소 계약(upload/remove)만 붙인다. */
function storageStub() {
  return {
    from: () => ({
      upload: async (path: string, _file: unknown, options: { contentType: string }) => {
        uploads.push({ path, contentType: options.contentType })

        return { error: uploadError }
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
   끌고 오지 않는 부수 효과도 있다).

   목록은 **창구(kind)별**이다 — 버그제보 카테고리로 1:1 문의를 접수하는 요청이
   서버에서 거절되는지 보려면 스텁도 같은 축으로 갈라져 있어야 한다. */
const CATEGORIES = {
  inquiry: [
    { key: 'k0', label: '재화·아이템', subtypes: ['아이템 미지급/소실', '거래 오류'] },
    /* 세부 유형이 없는 카테고리 — 폼이 hidden 으로 싣는 '기타' 만 받는다. */
    { key: 'k1', label: '기타·건의', subtypes: [] },
  ],
  bug: [
    { key: 'k2', label: '접속·서버', subtypes: ['로그인/접속 불가', '강제 종료'] },
    { key: 'k3', label: '캐릭터·게임 진행', subtypes: ['보상 획득 오류'] },
  ],
  report: [{ key: 'k4', label: '불법 프로그램', subtypes: ['핵/치트 프로그램'] }],
} as const

const categoryKinds: string[] = []
vi.mock('@/lib/data/inquiry-categories', () => ({
  getInquiryCategories: async (kind: 'inquiry' | 'bug' | 'report') => {
    categoryKinds.push(kind)

    return CATEGORIES[kind].map((category) => ({
      ...category,
      description: null,
      prefill: '',
      kind,
    }))
  },
}))

const { createInquiry } = await import('@/lib/actions/inquiry-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

const USER = { id: 'aaaaaaaa-0000-4000-8000-000000000001', nickname: '모험가', role: 'user' }
const INQUIRY_ID = '33333333-0000-4000-8000-000000000001'

function inquiryForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData()
  const values = {
    accountId: '20123456789000000',
    category: '재화·아이템',
    type: '아이템 미지급/소실',
    title: '로그인이 되지 않습니다',
    content: '어제부터 로그인 화면에서 멈춥니다.',
    consent: 'on',
    ...overrides,
  }

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

beforeEach(() => {
  getCurrentUser.mockReset()
  categoryKinds.length = 0
  uploads = []
  removed = []
  uploadError = null
  /* 1) 마지막 접수 시각 조회(도배 판정) 2) insert().select().single() */
  stub = createSupabaseStub([
    { data: null, error: null },
    { data: { id: INQUIRY_ID }, error: null },
  ])
})

describe('createInquiry', () => {
  it('should reject a subtype that does not belong to the chosen category', async () => {
    // Arrange — 화면에서는 만들 수 없는 조합이다(카테고리를 바꾸면 유형이 비워진다).
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await createInquiry(
      'inquiry',
      EMPTY_FORM_STATE,
      inquiryForm({ type: '보상 획득 오류' }),
    )

    // Assert — DB 까지 가지 않고 필드 오류로 돌려준다.
    expect(result.fieldErrors?.type).toContain('세부 문의 유형')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should accept 기타 for a category that has no subtypes', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    await createInquiry(
      'inquiry',
      EMPTY_FORM_STATE,
      inquiryForm({ category: '기타·건의', type: '기타' }),
    ).catch(() => undefined)

    // Assert
    expect(stub.inserts[0]).toMatchObject({ category: '기타·건의', type: '기타' })
  })

  it('should require the 메이플월드 계정 ID', async () => {
    // Arrange — 2026-09-11 부터 필수다. 첨부만 선택 항목이다.
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await createInquiry('inquiry', EMPTY_FORM_STATE, inquiryForm({ accountId: '' }))

    // Assert
    expect(result.fieldErrors?.accountId).toContain('계정 ID')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should refuse to accept an inquiry without a session', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(null)

    // Act
    const result = await createInquiry('inquiry', EMPTY_FORM_STATE, inquiryForm())

    // Assert
    expect(result.formError).toContain('로그인')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should require the privacy consent checkbox', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    const formData = inquiryForm()
    formData.delete('consent')

    // Act
    const result = await createInquiry('inquiry', EMPTY_FORM_STATE, formData)

    // Assert
    expect(result.fieldErrors?.consent).toContain('동의')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should store the inquiry as pending and owned by the signed in user', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const error = await createInquiry('inquiry', EMPTY_FORM_STATE, inquiryForm()).catch(
      (thrown: Error) => thrown,
    )

    // Assert
    expect(stub.inserts[0]).toMatchObject({
      user_id: USER.id,
      account_id: '20123456789000000',
      kind: 'inquiry',
      category: '재화·아이템',
      type: '아이템 미지급/소실',
      privacy_consent: true,
      status: 'pending',
      attachments: [],
    })
    expect((error as Error).message).toBe(
      `${REDIRECT_PREFIX}/support/inquiries/${INQUIRY_ID}?submitted=1`,
    )
  })

  it('should block a second inquiry inside the cooldown window', async () => {
    // Arrange — 방금 접수한 문의가 있으면 도배로 본다.
    getCurrentUser.mockResolvedValue(USER)
    stub = createSupabaseStub([{ data: { created_at: new Date().toISOString() }, error: null }])

    // Act
    const result = await createInquiry('inquiry', EMPTY_FORM_STATE, inquiryForm())

    // Assert
    expect(result.formError).toContain('초 후에')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should upload attachments under the user folder and record their metadata', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    const formData = inquiryForm()
    formData.append('attachments', new File(['png-bytes'], 'shot.png', { type: 'image/png' }))

    // Act
    await createInquiry('inquiry', EMPTY_FORM_STATE, formData).catch(() => undefined)

    // Assert — 정책(`inquiry_attachments_insert_own`)이 요구하는 `{uid}/` 접두사.
    expect(uploads[0]?.path.startsWith(`${USER.id}/`)).toBe(true)
    expect(uploads[0]?.contentType).toBe('image/png')
    expect(stub.inserts[0]).toMatchObject({
      attachments: [expect.objectContaining({ name: 'shot.png', mimeType: 'image/png' })],
    })
  })

  it('should reject attachments the bucket would refuse', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    const formData = inquiryForm()
    formData.append('attachments', new File(['zip'], 'a.zip', { type: 'application/zip' }))

    // Act
    const result = await createInquiry('inquiry', EMPTY_FORM_STATE, formData)

    // Assert
    expect(result.fieldErrors?.attachments).toBeDefined()
    expect(uploads).toHaveLength(0)
  })

  it('should not insert a row when an attachment upload fails', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    uploadError = { message: 'storage down' }
    const formData = inquiryForm()
    formData.append('attachments', new File(['png'], 'shot.png', { type: 'image/png' }))

    // Act
    const result = await createInquiry('inquiry', EMPTY_FORM_STATE, formData)

    // Assert
    expect(result.formError).toContain('첨부파일')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should clean up uploaded files when the insert fails', async () => {
    // Arrange — 고아 오브젝트가 비공개 버킷에 쌓이지 않아야 한다.
    getCurrentUser.mockResolvedValue(USER)
    stub = createSupabaseStub([
      { data: null, error: null },
      { data: null, error: { message: 'insert failed' } },
    ])
    const formData = inquiryForm()
    formData.append('attachments', new File(['png'], 'shot.png', { type: 'image/png' }))

    // Act
    const result = await createInquiry('inquiry', EMPTY_FORM_STATE, formData)

    // Assert
    expect(result.formError).toContain('접수하지 못했습니다')
    expect(removed[0]).toHaveLength(1)
  })
})

describe('createInquiry 창구(kind)', () => {
  it('should validate against the categories of the bound kind', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act — 버그제보 창구로 그 창구의 카테고리를 접수한다.
    await createInquiry(
      'bug',
      EMPTY_FORM_STATE,
      inquiryForm({ category: '접속·서버', type: '로그인/접속 불가' }),
    ).catch(() => undefined)

    // Assert — 허용 목록을 그 창구에서 읽고, 행에도 같은 창구를 적는다.
    expect(categoryKinds).toEqual(['bug'])
    expect(stub.inserts[0]).toMatchObject({ kind: 'bug', category: '접속·서버' })
  })

  it('should reject a category that belongs to another kind', async () => {
    /* Arrange — 화면에서는 만들 수 없는 조합이다(창구마다 셀렉트가 다르다). 직접
       POST 로 섞어 보내면 트리거가 kind 를 되돌려 버그제보가 1:1 문의로 남는다. */
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await createInquiry(
      'inquiry',
      EMPTY_FORM_STATE,
      inquiryForm({ category: '접속·서버', type: '로그인/접속 불가' }),
    )

    // Assert — DB 까지 가지 않고 필드 오류로 돌려준다.
    expect(result.fieldErrors?.category).toContain('카테고리')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should fall back to the default kind when the bound value is unknown', async () => {
    /* Arrange — bind 인자는 Next 가 서명하지만 값의 모양까지 보장하지는 않는다.
       모르는 창구에 접수를 막기보다 사람이 보는 1:1 문의로 떨어뜨린다. */
    getCurrentUser.mockResolvedValue(USER)

    // Act
    await createInquiry('spam' as unknown as 'inquiry', EMPTY_FORM_STATE, inquiryForm()).catch(
      () => undefined,
    )

    // Assert
    expect(categoryKinds).toEqual(['inquiry'])
    expect(stub.inserts[0]).toMatchObject({ kind: 'inquiry' })
  })
})
