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

const getCurrentUser = vi.fn()
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: () => getCurrentUser() }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { submitReport } = await import('@/lib/actions/report-actions')
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
const DETAIL_PATH = `/community/${POST_ID}`

function reportForm(overrides: Record<string, string> = {}): FormData {
  const formData = new FormData()
  const values = {
    targetType: 'post',
    targetId: POST_ID,
    reason: 'spam',
    detail: '',
    next: DETAIL_PATH,
    ...overrides,
  }

  for (const [key, value] of Object.entries(values)) {
    formData.set(key, value)
  }

  return formData
}

/** 액션이 소비하는 순서: 최근 신고 조회 → 대상 조회 → insert. */
type StubOptions = {
  latestReportAt?: string | null
  target?: Record<string, unknown> | null
  insertError?: unknown
}

function stubFor({
  latestReportAt = null,
  target = { author_id: OTHER_ID },
  insertError = null,
}: StubOptions) {
  return createSupabaseStub([
    { data: latestReportAt === null ? null : { created_at: latestReportAt }, error: null },
    { data: target, error: null },
    { data: null, error: insertError },
  ])
}

beforeEach(() => {
  getCurrentUser.mockReset()
  stub = createSupabaseStub()
})

describe('submitReport', () => {
  it('should send anonymous visitors to login with a return path', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(null)

    // Act
    const promise = submitReport(EMPTY_FORM_STATE, reportForm())

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/login?next=${encodeURIComponent(DETAIL_PATH)}`,
    )
    expect(stub.inserts).toHaveLength(0)
  })

  it('should refuse an off-origin return path', async () => {
    // Arrange — 오픈 리다이렉트 시도
    getCurrentUser.mockResolvedValue(null)

    // Act
    const promise = submitReport(EMPTY_FORM_STATE, reportForm({ next: '//evil.example' }))

    // Assert
    await expect(promise).rejects.toThrow(
      `${REDIRECT_PREFIX}/login?next=${encodeURIComponent('/')}`,
    )
  })

  it('should return a field error when no reason is chosen', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await submitReport(EMPTY_FORM_STATE, reportForm({ reason: '' }))

    // Assert
    expect(result.fieldErrors?.reason).toBeDefined()
    expect(stub.inserts).toHaveLength(0)
  })

  it('should reject a target id that is not a uuid', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)

    // Act
    const result = await submitReport(EMPTY_FORM_STATE, reportForm({ targetId: '42' }))

    // Assert
    expect(result.fieldErrors?.targetId).toBeDefined()
  })

  it('should block reporting again within the cooldown window', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ latestReportAt: new Date().toISOString() })

    // Act
    const result = await submitReport(EMPTY_FORM_STATE, reportForm())

    // Assert
    expect(result.formError).toContain('초 후에')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should refuse to report content the reporter wrote', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ target: { author_id: USER.id } })

    // Act
    const result = await submitReport(EMPTY_FORM_STATE, reportForm())

    // Assert
    expect(result.formError).toBe('본인이 작성한 글은 신고할 수 없습니다.')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should report a missing target instead of inserting an orphan row', async () => {
    // Arrange — 이미 삭제됐거나 비공개라 조회 정책을 통과하지 못한 경우
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ target: null })

    // Act
    const result = await submitReport(EMPTY_FORM_STATE, reportForm())

    // Assert
    expect(result.formError).toContain('찾을 수 없습니다')
    expect(stub.inserts).toHaveLength(0)
  })

  it('should turn a unique violation into a duplicate notice for a post', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ insertError: { code: '23505', message: 'duplicate key value' } })

    // Act
    const result = await submitReport(EMPTY_FORM_STATE, reportForm())

    // Assert
    expect(result.formError).toBe('이미 신고한 게시글입니다.')
  })

  it('should name the comment when a comment was already reported', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ insertError: { code: '23505', message: 'duplicate key value' } })

    // Act
    const result = await submitReport(EMPTY_FORM_STATE, reportForm({ targetType: 'comment' }))

    // Assert
    expect(result.formError).toBe('이미 신고한 댓글입니다.')
  })

  it('should never leak the raw database message', async () => {
    /* Arrange — 정책 위반(42501)은 정지 안내로 옮겨 적으므로(아래 '정지 계정' 참고)
       여기서는 그 밖의 DB 오류로 제약 이름이 새지 않는지만 본다. */
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({
      insertError: {
        code: '23503',
        message: 'violates foreign key constraint "reports_reporter_id_fkey"',
      },
    })

    // Act
    const result = await submitReport(EMPTY_FORM_STATE, reportForm())

    // Assert
    expect(result.formError).toBe('신고를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.')
    expect(result.formError).not.toContain('constraint')
  })

  it('should insert the report and confirm the submission', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({})

    // Act
    const result = await submitReport(
      EMPTY_FORM_STATE,
      reportForm({ detail: '  광고 링크  ', reason: 'obscene' }),
    )

    // Assert
    expect(result.message).toBe('신고가 접수되었습니다. 검토 후 운영정책에 따라 처리됩니다.')
    expect(stub.inserts[0]).toMatchObject({
      target_type: 'post',
      target_id: POST_ID,
      reporter_id: USER.id,
      reason: 'obscene',
      detail: '광고 링크',
    })
  })

  it('should look up comments when the target is a comment', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({})

    // Act
    await submitReport(EMPTY_FORM_STATE, reportForm({ targetType: 'comment' }))

    // Assert
    expect(stub.tables).toEqual(['reports', 'comments', 'reports'])
  })
})

describe('정지 계정', () => {
  it('should refuse a report with the suspension notice before touching the table', async () => {
    // Arrange
    getCurrentUser.mockResolvedValue(SUSPENDED_USER)

    // Act
    const result = await submitReport(EMPTY_FORM_STATE, reportForm())

    // Assert
    expect(result.formError).toBe(SUSPENDED_NOTICE)
    expect(stub.inserts).toHaveLength(0)
  })

  it('should map an RLS violation to the suspension notice', async () => {
    // Arrange — 접수 직전에 정지가 걸려 정책이 막은 경우
    getCurrentUser.mockResolvedValue(USER)
    stub = stubFor({ insertError: RLS_ERROR })

    // Act
    const result = await submitReport(EMPTY_FORM_STATE, reportForm())

    // Assert
    expect(result.formError).toBe(SUSPENDED_FALLBACK)
  })
})
