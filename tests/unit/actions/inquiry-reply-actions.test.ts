import { beforeEach, describe, expect, it, vi } from 'vitest'

import { INQUIRY_REPLY_TOO_MANY_NOTICE } from '@/lib/constants/inquiry-thread'

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

/** 첨부 확정 경로가 서비스 롤 클라이언트(`server-only`)를 끌고 온다. 테스트에서는 비운다. */
vi.mock('server-only', () => ({}))

const getCurrentUser = vi.fn()
vi.mock('@/lib/auth/current-user', () => ({ getCurrentUser: () => getCurrentUser() }))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { replyToInquiry } = await import('@/lib/actions/inquiry-reply-actions')

const USER = {
  id: 'aaaaaaaa-0000-4000-8000-000000000001',
  nickname: '모험가',
  role: 'user',
  suspendedUntil: null,
  suspensionReason: null,
}
const INQUIRY_ID = '33333333-0000-4000-8000-000000000001'
const DETAIL_PATH = `/support/inquiries/${INQUIRY_ID}`

/** 첨부 없는 답장 폼. 첨부 필드가 비면 확정 단계는 스토리지를 건드리지 않는다. */
function replyForm(content = '요청하신 스크린샷을 남깁니다.'): FormData {
  const formData = new FormData()

  formData.set('content', content)

  return formData
}

function send(form: FormData = replyForm()) {
  return replyToInquiry(INQUIRY_ID, {}, form)
}

beforeEach(() => {
  vi.clearAllMocks()
  getCurrentUser.mockResolvedValue(USER)
  stub = createSupabaseStub([{ data: { ok: true, reply_id: 'r-1' }, error: null }])
})

describe('replyToInquiry', () => {
  it('should send the reply through the rpc and redirect with the replied flag', async () => {
    // Arrange · Act
    const error = await send().catch((thrown: Error) => thrown)

    // Assert — 성공 경로는 redirect 예외로 끝난다
    expect(error).toBeInstanceOf(Error)
    expect((error as Error).message).toBe(`${REDIRECT_PREFIX}${DETAIL_PATH}?replied=1`)
    expect(stub.rpcCalls).toEqual([
      {
        name: 'add_inquiry_user_reply',
        args: {
          p_inquiry_id: INQUIRY_ID,
          p_content: '요청하신 스크린샷을 남깁니다.',
          p_attachments: [],
        },
      },
    ])
  })

  /**
   * 답장에는 쿨다운이 없다(오너 결정 2026-09-15).
   *
   * 예전에는 액션이 RPC 앞에서 마지막 쓰기 시각을 조회해 30초 창을 쟀다. 그 조회가
   * 남아 있으면 스텁이 준비한 결과가 RPC 대신 그 쿼리로 새기 때문에, "테이블 조회를
   * 한 번도 하지 않는다"가 곧 검사가 걷혔다는 증거가 된다.
   */
  it('should not read any write timestamp before calling the rpc', async () => {
    // Arrange · Act
    await send().catch(() => undefined)

    // Assert
    expect(stub.tables).toEqual([])
  })

  it('should send two replies in a row without a cooldown message', async () => {
    // Arrange — 연속 두 번. 두 번째도 RPC 까지 간다.
    stub = createSupabaseStub([
      { data: { ok: true, reply_id: 'r-1' }, error: null },
      { data: { ok: true, reply_id: 'r-2' }, error: null },
    ])

    // Act
    await send().catch(() => undefined)
    await send(replyForm('한 줄 더 남깁니다.')).catch(() => undefined)

    // Assert
    expect(stub.rpcCalls).toHaveLength(2)
  })

  it('should surface the one-reply window from the rpc as a form error', async () => {
    // Arrange — 연타를 막는 것은 쿨다운이 아니라 RPC 의 1건 규칙이다
    stub = createSupabaseStub([{ data: { ok: false, code: 'too_many' }, error: null }])

    // Act
    const result = await send()

    // Assert
    expect(result).toEqual({ formError: INQUIRY_REPLY_TOO_MANY_NOTICE })
  })
})
