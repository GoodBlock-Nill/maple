import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * 스레드 조회(`getInquiryReplies`)의 두 가지 계약.
 *
 *   1. 웹 회원 답장은 `direction='inbound'` **+ `author_id` 있음**이다. 이메일
 *      인바운드도 inbound 라 방향만 보면 둘이 한 덩어리가 된다.
 *   2. 첨부 서명은 스레드 전체를 **한 번에** 부른다. 답장마다 부르면 10건짜리
 *      대화에서 Storage 왕복이 10번 생긴다.
 */

vi.mock('server-only', () => ({}))

const createSignedUrls = vi.fn(async (paths: readonly string[]) => ({
  data: paths.map((path) => ({ path, signedUrl: `https://signed.test/${path}`, error: null })),
  error: null,
}))

let rows: unknown[] = []

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from(_table: string) {
      const builder = {
        select: () => builder,
        eq: () => builder,
        order: () => builder,
        then: (resolve: (value: { data: unknown; error: unknown }) => unknown) =>
          resolve({ data: rows, error: null }),
      }

      return builder
    },
    storage: { from: () => ({ createSignedUrls }) },
  })),
}))

const { getInquiryReplies } = await import('@/lib/data/inquiry-replies')

const INQUIRY_ID = '11111111-2222-4333-8444-555555555555'
const MEMBER_ID = '99999999-2222-4333-8444-555555555555'

function attachment(path: string) {
  return { name: path, path, size: 10, mimeType: 'image/png' }
}

beforeEach(() => {
  rows = []
  createSignedUrls.mockClear()
})

describe('getInquiryReplies', () => {
  it('inbound + author_id 만 회원 답장으로 표시한다', async () => {
    // Arrange
    rows = [
      {
        id: 'r1',
        author_id: null,
        author_name: '운영자',
        content: '확인 중입니다.',
        created_at: '2026-09-14T01:00:00Z',
        direction: 'outbound',
        email_message_id: null,
        delivery_status: null,
        attachments: [],
      },
      {
        id: 'r2',
        author_id: MEMBER_ID,
        author_name: '글자용사',
        content: '이미지 첨부합니다.',
        created_at: '2026-09-14T02:00:00Z',
        direction: 'inbound',
        email_message_id: null,
        delivery_status: null,
        attachments: [attachment('member/shot.png')],
      },
      {
        id: 'r3',
        author_id: null,
        author_name: 'user@example.test',
        content: '메일로 보냅니다.',
        created_at: '2026-09-14T03:00:00Z',
        direction: 'inbound',
        email_message_id: '<abc@example.test>',
        delivery_status: null,
        attachments: [],
      },
    ]

    // Act
    const replies = await getInquiryReplies(INQUIRY_ID)

    // Assert
    expect(replies.map((reply) => reply.isMemberReply)).toEqual([false, true, false])
  })

  it('첨부는 스레드 전체를 한 번에 서명하고 원래 답장으로 되돌려 놓는다', async () => {
    // Arrange
    rows = [
      {
        id: 'r1',
        author_id: null,
        author_name: '운영자',
        content: '자료 보냅니다.',
        created_at: '2026-09-14T01:00:00Z',
        direction: 'outbound',
        email_message_id: null,
        delivery_status: null,
        attachments: [attachment('operator/guide.png')],
      },
      {
        id: 'r2',
        author_id: MEMBER_ID,
        author_name: '글자용사',
        content: '두 장 올립니다.',
        created_at: '2026-09-14T02:00:00Z',
        direction: 'inbound',
        email_message_id: null,
        delivery_status: null,
        attachments: [attachment('member/a.png'), attachment('member/b.png')],
      },
    ]

    // Act
    const replies = await getInquiryReplies(INQUIRY_ID)

    // Assert
    expect(createSignedUrls).toHaveBeenCalledTimes(1)
    expect(createSignedUrls.mock.calls[0]?.[0]).toEqual([
      'operator/guide.png',
      'member/a.png',
      'member/b.png',
    ])
    expect(replies[0]?.attachments.map((item) => item.url)).toEqual([
      'https://signed.test/operator/guide.png',
    ])
    expect(replies[1]?.attachments.map((item) => item.path)).toEqual([
      'member/a.png',
      'member/b.png',
    ])
  })

  it('첨부가 하나도 없으면 서명을 부르지 않는다', async () => {
    rows = [
      {
        id: 'r1',
        author_id: null,
        author_name: '운영자',
        content: '확인 중입니다.',
        created_at: '2026-09-14T01:00:00Z',
        direction: 'outbound',
        email_message_id: null,
        delivery_status: null,
        attachments: [],
      },
    ]

    const replies = await getInquiryReplies(INQUIRY_ID)

    expect(createSignedUrls).not.toHaveBeenCalled()
    expect(replies[0]?.attachments).toEqual([])
  })
})
