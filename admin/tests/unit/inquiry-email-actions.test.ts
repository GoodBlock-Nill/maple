import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 이메일 문의의 답신 흐름.
 *
 * 고정하려는 것은 셋이다.
 *
 * 1. 콘솔이 **비밀을 들지 않는다** — 발송은 Edge Function 호출이고, 헤더에 실리는 것은
 *    로그인한 관리자의 토큰과 anon 키뿐이다(제공자 API 키는 함수 secret 에만 있다).
 * 2. 답신은 **먼저 저장된다.** 발송이 실패해도 글은 남고, 문구가 그 사실을 말한다 —
 *    그러지 않으면 운영자가 같은 답신을 한 번 더 쓴다.
 * 3. 웹 문의는 예전 그대로다. 출처 분기가 1:1 문의 흐름을 건드리면 안 된다.
 */

const INQUIRY_ID = '11111111-2222-4333-8444-555555555555'
const REPLY_ID = '99999999-8888-4777-8666-555555555555'
const FUNCTION_URL = 'https://stub.supabase.co/functions/v1/email-outbound'

const ACTOR = {
  id: '11111111-1111-4111-8111-111111111111',
  email: 'admin@stub.local',
  nickname: '운영자',
  role: 'admin',
  roleKey: 'super_admin',
  roleName: '슈퍼어드민',
  permissions: { inquiries: 'write' },
  isSuperAdmin: true,
}

/** 목 팩토리는 호이스팅되므로 공유 상태도 함께 끌어올린다. */
const db = vi.hoisted(() => ({
  inquiry: { status: 'pending', cancelled_at: null, source: 'email' } as Record<
    string,
    unknown
  > | null,
  reply: null as Record<string, unknown> | null,
  inserts: [] as { table: string; payload: Record<string, unknown> }[],
  session: { access_token: 'access-token-1' } as { access_token: string } | null,
}))

vi.mock('server-only', () => ({}))
vi.mock('@/lib/auth/require-admin', () => ({
  requireAdmin: vi.fn(async () => ACTOR),
  requirePermission: vi.fn(async () => ACTOR),
  requireAnyPermission: vi.fn(async () => ACTOR),
  requireSuperAdmin: vi.fn(async () => ACTOR),
}))
vi.mock('@/lib/audit', () => ({ writeAuditLog: vi.fn(async () => undefined) }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

/* actions-no-raw-error.test.ts 와 같은 방식의 체이너블 빌더. 테이블 이름을 기억해
   `maybeSingle()` 이 문의 상태와 답신 행을 각각 돌려줄 수 있게 한다. */
vi.mock('@/lib/supabase/server', () => {
  function builder(table: string) {
    const self: Record<string, unknown> = {
      maybeSingle: async () => ({
        data: table === 'inquiries' ? db.inquiry : db.reply,
        error: null,
      }),
      single: async () => ({ data: { id: REPLY_ID }, error: null }),
      insert: (payload: Record<string, unknown>) => {
        db.inserts.push({ table, payload })

        return self
      },
      then: (resolve: (value: unknown) => unknown) =>
        resolve({ data: null, count: 0, error: null }),
    }

    for (const method of ['select', 'update', 'upsert', 'delete', 'eq', 'in', 'order']) {
      self[method] = () => self
    }

    return self
  }

  return {
    createClient: async () => ({
      from: (table: string) => builder(table),
      auth: { getSession: async () => ({ data: { session: db.session }, error: null }) },
    }),
  }
})

const { replyToInquiryAction } = await import('@/lib/actions/inquiries-actions')
const { resendInquiryEmailAction } = await import('@/lib/actions/inquiry-email-actions')
const { EMPTY_FORM_STATE } = await import('@/lib/actions/form-state')

const NOT_CONFIGURED =
  "이메일 발송 설정이 아직 없습니다. 답신은 저장되었고, 설정 후 '다시 보내기'로 발송할 수 있습니다."

function formData(fields: Record<string, string>): FormData {
  const data = new FormData()

  for (const [key, value] of Object.entries(fields)) {
    data.set(key, value)
  }

  return data
}

function replyForm(): FormData {
  return formData({
    inquiryId: INQUIRY_ID,
    content: '메일로 나갈 답신 본문입니다.',
    nextStatus: 'answered',
    useOperatorName: 'on',
  })
}

function stubFetch(status: number, body: string) {
  const fetchMock = vi.fn(async () => ({ status, text: async () => body }))

  vi.stubGlobal('fetch', fetchMock)

  return fetchMock
}

function replyInsert() {
  return db.inserts.find((entry) => entry.table === 'inquiry_replies')?.payload
}

let errorSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://stub.supabase.co')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key-1')
  db.inquiry = { status: 'pending', cancelled_at: null, source: 'email' }
  db.reply = null
  db.inserts = []
  db.session = { access_token: 'access-token-1' }
})

afterEach(() => {
  errorSpy.mockRestore()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
})

describe('replyToInquiryAction (이메일 문의)', () => {
  it('should queue the reply and post it to the outbound function when the inquiry came by email', async () => {
    // Arrange
    const fetchMock = stubFetch(200, JSON.stringify({ ok: true, status: 'sent', messageId: 'm1' }))

    // Act
    const state = await replyToInquiryAction(EMPTY_FORM_STATE, replyForm())

    // Assert
    expect(replyInsert()).toMatchObject({ direction: 'outbound', delivery_status: 'queued' })
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]

    expect(url).toBe(FUNCTION_URL)
    expect(init.method).toBe('POST')
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      Authorization: 'Bearer access-token-1',
      apikey: 'anon-key-1',
    })
    expect(init.body).toBe(JSON.stringify({ replyId: REPLY_ID }))
    expect(state.message).toBe("답신을 이메일로 보내고 상태를 '답변 완료'로 바꿨습니다.")
  })

  it('should say the reply was saved when the mail provider is not configured yet', async () => {
    // Arrange
    stubFetch(503, JSON.stringify({ error: 'not_configured' }))

    // Act
    const state = await replyToInquiryAction(EMPTY_FORM_STATE, replyForm())

    // Assert — 설정 전은 정상적인 운영 상태다. 저장됐다는 사실과 다음 행동을 함께 적는다.
    expect(state.formError).toBe(NOT_CONFIGURED)
    expect(state.message).toBeUndefined()
  })

  it('should point the operator at 다시 보내기 when the function fails to send', async () => {
    // Arrange
    stubFetch(502, JSON.stringify({ error: 'send_failed' }))

    // Act
    const state = await replyToInquiryAction(EMPTY_FORM_STATE, replyForm())

    // Assert
    expect(state.formError).toBe(
      '답신은 저장했지만 메일을 보내지 못했습니다. 스레드에서 다시 보내기를 눌러 주세요.',
    )
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[inquiries]'),
      '502 {"error":"send_failed"}',
    )
  })

  it('should leave the web inquiry flow untouched when the source is not email', async () => {
    // Arrange
    db.inquiry = { status: 'pending', cancelled_at: null, source: 'web' }
    const fetchMock = stubFetch(200, '{}')

    // Act
    const state = await replyToInquiryAction(EMPTY_FORM_STATE, replyForm())

    // Assert
    expect(fetchMock).not.toHaveBeenCalled()
    expect(replyInsert()).toMatchObject({ direction: 'outbound' })
    expect(replyInsert()).not.toHaveProperty('delivery_status')
    expect(state.message).toBe("답변을 등록하고 상태를 '답변 완료'로 바꿨습니다.")
  })
})

describe('resendInquiryEmailAction', () => {
  it('should refuse a reply that already went out and never call the function', async () => {
    // Arrange
    db.reply = {
      id: REPLY_ID,
      inquiry_id: INQUIRY_ID,
      direction: 'outbound',
      delivery_status: 'sent',
    }
    const fetchMock = stubFetch(200, '{}')

    // Act
    const state = await resendInquiryEmailAction(EMPTY_FORM_STATE, formData({ replyId: REPLY_ID }))

    // Assert — 두 번 보내면 사용자가 같은 메일을 두 통 받는다.
    expect(state.formError).toBe('이미 발송된 답신입니다.')
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('should resend a failed reply and report it in one sentence', async () => {
    // Arrange
    db.reply = {
      id: REPLY_ID,
      inquiry_id: INQUIRY_ID,
      direction: 'outbound',
      delivery_status: 'failed',
    }
    const fetchMock = stubFetch(200, JSON.stringify({ ok: true, status: 'sent', messageId: 'm2' }))

    // Act
    const state = await resendInquiryEmailAction(EMPTY_FORM_STATE, formData({ replyId: REPLY_ID }))

    // Assert
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(state.message).toBe('답신 메일을 다시 보냈습니다.')
    expect(state.formError).toBeUndefined()
  })

  it('should refuse an inbound mail because there is nothing of ours to send', async () => {
    // Arrange
    db.reply = {
      id: REPLY_ID,
      inquiry_id: INQUIRY_ID,
      direction: 'inbound',
      delivery_status: null,
    }
    const fetchMock = stubFetch(200, '{}')

    // Act
    const state = await resendInquiryEmailAction(EMPTY_FORM_STATE, formData({ replyId: REPLY_ID }))

    // Assert
    expect(state.formError).toBe('받은 메일은 다시 보낼 수 없습니다.')
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
