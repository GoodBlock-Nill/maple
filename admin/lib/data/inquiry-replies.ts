import 'server-only'

import { signInquiryAttachments, toAttachments } from '@/lib/data/inquiry-attachments'
import { createClient } from '@/lib/supabase/server'

import type { InquiryAttachment } from '@/lib/data/inquiry-attachments'

/**
 * 문의 스레드(답글) 조회.
 *
 * `inquiries.ts` 에서 떼어 낸 것은 이메일 문의가 들어오면서 방향(받음/보냄)과
 * 발송 상태가 붙어 파일이 300줄을 넘기 때문이다. 화면은 계속
 * `@/lib/data/inquiries` 에서 가져다 쓴다(그쪽이 다시 내보낸다).
 */

/* 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
/* prettier-ignore */
const REPLY_COLUMNS = 'id, author_id, author_name, content, created_at, direction, email_message_id, delivery_status, attachments'

export type InquiryReplyDirection = 'inbound' | 'outbound'

/** 제공자 웹훅이 갱신한다. null 은 "발송 대상이 아님"(웹 문의의 답변)이다. */
export type InquiryReplyDeliveryStatus = 'queued' | 'sent' | 'failed'

export type InquiryReplyItem = {
  id: string
  authorName: string
  content: string
  createdAt: string
  direction: InquiryReplyDirection
  emailMessageId: string | null
  deliveryStatus: InquiryReplyDeliveryStatus | null
  /**
   * 회원이 웹에서 남긴 답장인가(20260914000400).
   *
   * 이메일 인바운드도 `direction='inbound'` 라 방향만으로는 갈리지 않는다.
   * 웹 답장만 `author_id` 가 채워지므로(RPC `add_inquiry_user_reply`) 그 유무로
   * 가른다 — 화면이 "회원 답장"과 "받은 메일"을 다른 말로 불러야 한다.
   */
  isMemberReply: boolean
  /** 이 답변·답장에 달린 첨부(서명 URL 포함). 없으면 빈 배열. */
  attachments: readonly InquiryAttachment[]
}

const DELIVERY_STATUSES: readonly string[] = ['queued', 'sent', 'failed']

/* 두 열 모두 `text` 라 제약 밖의 값이 들어올 여지가 있다. 모르는 값은 '보낸 답신'과
   '상태 없음'으로 떨어뜨린다 — 화면이 비거나 좌우 정렬이 뒤집히는 것보다 낫다. */
function toDirection(value: string | null): InquiryReplyDirection {
  return value === 'inbound' ? 'inbound' : 'outbound'
}

function toDeliveryStatus(value: string | null): InquiryReplyDeliveryStatus | null {
  return value !== null && DELIVERY_STATUSES.includes(value)
    ? (value as InquiryReplyDeliveryStatus)
    : null
}

/**
 * 스레드 전체의 첨부를 **한 번에** 서명한다.
 *
 * 답장마다 `signInquiryAttachments` 를 부르면 스레드 길이만큼 Storage 왕복이 생긴다
 * (10건짜리 대화면 왕복 10번). 전부 펼쳐 한 번에 서명하고 같은 순서로 다시 나눈다 —
 * `signInquiryAttachments` 는 입력 순서를 그대로 돌려준다.
 */
async function signThreadAttachments(
  rows: readonly { attachments: unknown }[],
): Promise<readonly (readonly InquiryAttachment[])[]> {
  const perRow = rows.map((row) => toAttachments(row.attachments))
  const flat = perRow.flat()

  if (flat.length === 0) {
    return perRow.map(() => [])
  }

  const signed = await signInquiryAttachments(flat)
  const grouped: (readonly InquiryAttachment[])[] = []
  let cursor = 0

  for (const items of perRow) {
    grouped.push(signed.slice(cursor, cursor + items.length))
    cursor += items.length
  }

  return grouped
}

export async function getInquiryReplies(inquiryId: string): Promise<readonly InquiryReplyItem[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inquiry_replies')
    .select(REPLY_COLUMNS)
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true })

  if (error !== null) {
    console.error('[inquiries] 답변 조회 실패', error.message)

    return []
  }

  const rows = data ?? []
  const attachments = await signThreadAttachments(rows)

  return rows.map((row, index) => ({
    id: row.id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
    direction: toDirection(row.direction),
    emailMessageId: row.email_message_id,
    deliveryStatus: toDeliveryStatus(row.delivery_status),
    isMemberReply: toDirection(row.direction) === 'inbound' && row.author_id !== null,
    attachments: attachments[index] ?? [],
  }))
}
