import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from '../actions/supabase-stub'

import type { SupabaseStub } from '../actions/supabase-stub'

/** `server-only` 는 클라이언트 환경에서 import 되면 예외를 던진다. 테스트에서는 비운다. */
vi.mock('server-only', () => ({}))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { getInquiryReplies } = await import('@/lib/data/inquiry-replies')

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const OTHER_USER_ID = 'aaaaaaaa-0000-4000-8000-000000000002'
const INQUIRY_ID = '33333333-0000-4000-8000-000000000001'

const OPERATOR_ROW = {
  id: 'r1',
  author_name: '운영자',
  content: '확인 후 안내드리겠습니다.',
  created_at: '2026-09-08T02:00:00.000Z',
  direction: 'outbound',
  author_id: null,
  attachments: [],
}

const MY_REPLY_ROW = {
  id: 'r2',
  author_name: '모험가',
  content: '스크린샷 첨부합니다.',
  created_at: '2026-09-08T03:00:00.000Z',
  direction: 'inbound',
  author_id: USER_ID,
  attachments: [
    { name: 'shot.png', path: `${USER_ID}/shot.png`, size: 1024, mimeType: 'image/png' },
  ],
}

beforeEach(() => {
  stub = createSupabaseStub([{ data: [OPERATOR_ROW], error: null }])
})

describe('getInquiryReplies', () => {
  it('should map a reply to the domain shape', async () => {
    // Arrange & Act
    const replies = await getInquiryReplies(INQUIRY_ID, USER_ID)

    // Assert
    expect(stub.tables).toEqual(['inquiry_replies'])
    expect(replies[0]).toEqual({
      id: 'r1',
      authorName: '운영자',
      content: '확인 후 안내드리겠습니다.',
      createdAt: '2026-09-08T02:00:00.000Z',
      direction: 'outbound',
      isMine: false,
      attachments: [],
    })
  })

  it('should mark only the current user inbound replies as mine', async () => {
    // Arrange — 같은 행을 서로 다른 사용자로 읽는다(관리자 세션도 이 화면을 연다).
    stub = createSupabaseStub([{ data: [MY_REPLY_ROW], error: null }])

    // Act
    const mine = await getInquiryReplies(INQUIRY_ID, USER_ID)

    stub = createSupabaseStub([{ data: [MY_REPLY_ROW], error: null }])

    const theirs = await getInquiryReplies(INQUIRY_ID, OTHER_USER_ID)

    // Assert
    expect(mine[0]?.isMine).toBe(true)
    expect(theirs[0]?.isMine).toBe(false)
  })

  it('should treat an inbound email reply as not mine', async () => {
    // Arrange — 이메일 인바운드는 방향은 같지만 작성자가 없다(20260909000300).
    stub = createSupabaseStub([{ data: [{ ...MY_REPLY_ROW, author_id: null }], error: null }])

    // Act
    const replies = await getInquiryReplies(INQUIRY_ID, USER_ID)

    // Assert
    expect(replies[0]?.direction).toBe('inbound')
    expect(replies[0]?.isMine).toBe(false)
  })

  it('should attach a signed url to every reply attachment', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: [OPERATOR_ROW, MY_REPLY_ROW], error: null }])

    // Act
    const replies = await getInquiryReplies(INQUIRY_ID, USER_ID)

    // Assert — 비공개 버킷이라 링크가 곧 접근 경로다.
    expect(replies[1]?.attachments[0]?.url).toContain(`inquiry-attachments/${USER_ID}/shot.png`)
  })

  it('should drop attachment entries that have no storage path', async () => {
    // Arrange — jsonb 라 모양이 보장되지 않는다.
    stub = createSupabaseStub([
      { data: [{ ...MY_REPLY_ROW, attachments: [{ name: 'broken.png' }] }], error: null },
    ])

    // Act
    const replies = await getInquiryReplies(INQUIRY_ID, USER_ID)

    // Assert
    expect(replies[0]?.attachments).toEqual([])
  })

  it('should fall back to an empty thread when replies cannot be read', async () => {
    // Arrange — 답변을 못 읽었다고 본문까지 감출 이유는 없다.
    stub = createSupabaseStub([{ data: null, error: { message: 'boom' } }])

    // Act
    const replies = await getInquiryReplies(INQUIRY_ID, USER_ID)

    // Assert
    expect(replies).toEqual([])
  })
})
