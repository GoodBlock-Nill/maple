import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSupabaseStub } from '../actions/supabase-stub'

import type { SupabaseStub } from '../actions/supabase-stub'

/** `server-only` 는 클라이언트 환경에서 import 되면 예외를 던진다. 테스트에서는 비운다. */
vi.mock('server-only', () => ({}))

let stub: SupabaseStub
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => stub.client }))

const { getInquiryReplies, getMyInquiries, getMyInquiry, toAttachments } =
  await import('@/lib/data/inquiries')

const USER_ID = 'aaaaaaaa-0000-4000-8000-000000000001'
const INQUIRY_ID = '33333333-0000-4000-8000-000000000001'

const LIST_ROW = {
  id: INQUIRY_ID,
  title: '로그인이 되지 않습니다',
  category: '계정',
  type: '문의',
  status: 'pending',
  created_at: '2026-09-08T01:00:00.000Z',
  inquiry_replies: [{ count: 2 }],
}

const DETAIL_ROW = {
  id: INQUIRY_ID,
  title: '로그인이 되지 않습니다',
  category: '계정',
  type: '문의',
  status: 'answered',
  created_at: '2026-09-08T01:00:00.000Z',
  account_id: '123456789000000',
  content: '어제부터 로그인 화면에서 멈춥니다.',
  attachments: [
    { name: 'shot.png', path: `${USER_ID}/shot.png`, size: 1024, mimeType: 'image/png' },
  ],
}

beforeEach(() => {
  stub = createSupabaseStub([{ data: [LIST_ROW], error: null, count: 1 } as never])
})

describe('getMyInquiries', () => {
  it('should read the inquiries table and map the embedded reply count', async () => {
    // Arrange & Act
    const list = await getMyInquiries(USER_ID)

    // Assert
    expect(stub.tables).toEqual(['inquiries'])
    expect(list.items[0]).toMatchObject({ id: INQUIRY_ID, status: 'pending', replyCount: 2 })
  })

  it('should report the state of a single page for the numbered pagination', async () => {
    // Arrange — 전체 25건 중 2페이지(6건)만 받은 상태.
    stub = createSupabaseStub([
      { data: Array.from({ length: 6 }, () => LIST_ROW), error: null, count: 25 } as never,
    ])

    // Act
    const list = await getMyInquiries(USER_ID, 2)

    // Assert — 누적이 아니라 이 페이지 건수다.
    expect(list.shown).toBe(6)
    expect(list.page).toBe(2)
    expect(list.total).toBe(25)
    expect(list.hasMore).toBe(true)
  })

  it('should read only the requested page from the table', async () => {
    // Arrange & Act — 누적 조회로 남아 있으면 페이지를 넘길수록 응답이 무거워진다.
    await getMyInquiries(USER_ID, 2)

    // Assert — 페이지 크기 6 → 2페이지는 6..11 행이다.
    expect(stub.ranges).toContainEqual([6, 11])
  })

  it('should treat a query failure as an error the page can surface', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: null, error: { message: 'boom' } }])

    // Act & Assert
    await expect(getMyInquiries(USER_ID)).rejects.toThrow('문의 내역을 불러오지 못했습니다')
  })

  it('should exclude cancelled inquiries so they disappear from the list', async () => {
    // Arrange & Act — 오너 요청(2026-09-11): 접수 취소한 문의는 목록에서 사라진다.
    await getMyInquiries(USER_ID)

    // Assert
    expect(stub.isFilters).toContainEqual(['cancelled_at', null])
  })
})

describe('getMyInquiry', () => {
  it('should map the detail row including attachments', async () => {
    // Arrange
    stub = createSupabaseStub([{ data: DETAIL_ROW, error: null }])

    // Act
    const inquiry = await getMyInquiry(INQUIRY_ID, USER_ID)

    // Assert
    expect(inquiry?.accountId).toBe('123456789000000')
    expect(inquiry?.attachments).toHaveLength(1)
  })

  it('should return null when the row is missing or not owned', async () => {
    // Arrange — RLS 로 안 보이는 행은 "없는 행"과 구분되지 않는다(의도한 동작).
    stub = createSupabaseStub([{ data: null, error: null }])

    // Act
    const inquiry = await getMyInquiry(INQUIRY_ID, USER_ID)

    // Assert
    expect(inquiry).toBeNull()
  })
})

describe('getInquiryReplies', () => {
  it('should map replies to the domain shape', async () => {
    // Arrange
    stub = createSupabaseStub([
      {
        data: [
          {
            id: 'r1',
            author_name: '운영자',
            content: '확인 후 안내드리겠습니다.',
            created_at: '2026-09-08T02:00:00.000Z',
          },
        ],
        error: null,
      },
    ])

    // Act
    const replies = await getInquiryReplies(INQUIRY_ID)

    // Assert
    expect(stub.tables).toEqual(['inquiry_replies'])
    expect(replies[0]).toEqual({
      id: 'r1',
      authorName: '운영자',
      content: '확인 후 안내드리겠습니다.',
      createdAt: '2026-09-08T02:00:00.000Z',
    })
  })

  it('should fall back to an empty thread when replies cannot be read', async () => {
    // Arrange — 답변을 못 읽었다고 본문까지 감출 이유는 없다.
    stub = createSupabaseStub([{ data: null, error: { message: 'boom' } }])

    // Act
    const replies = await getInquiryReplies(INQUIRY_ID)

    // Assert
    expect(replies).toEqual([])
  })
})

describe('toAttachments', () => {
  it('should drop entries that have no storage path', () => {
    // Arrange & Act — jsonb 라 모양이 보장되지 않는다.
    const attachments = toAttachments([
      { name: 'a.png', path: 'uid/a.png', size: 10, mimeType: 'image/png' },
      { name: 'broken.png' },
      'nonsense',
    ])

    // Assert
    expect(attachments).toHaveLength(1)
    expect(attachments[0]?.path).toBe('uid/a.png')
  })

  it('should return an empty list for a non-array value', () => {
    // Arrange & Act & Assert
    expect(toAttachments(null)).toEqual([])
    expect(toAttachments({ path: 'uid/a.png' })).toEqual([])
  })

  it('should fill missing metadata with safe defaults', () => {
    // Arrange & Act
    const [attachment] = toAttachments([{ path: 'uid/a.png' }])

    // Assert — 이름이 없으면 경로를 그대로 보여 준다(빈 링크보다 낫다).
    expect(attachment).toEqual({ name: 'uid/a.png', path: 'uid/a.png', size: 0, mimeType: '' })
  })
})
