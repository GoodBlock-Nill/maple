import 'server-only'

import { INQUIRY_PAGE_SIZE } from '@/lib/constants/support'
import { accumulatedRange, toListResult } from '@/lib/data/query'
import { createClient } from '@/lib/supabase/server'
import { STORAGE_BUCKETS } from '@/lib/supabase/storage'

import type { TypedSupabaseClient } from '@/lib/supabase/types'
import type {
  InquiryAttachment,
  InquiryDetail,
  InquiryReply,
  InquiryStatus,
  InquirySummary,
  ListResult,
  SignedInquiryAttachment,
} from '@/types/domain'

/**
 * 내 문의 내역 데이터 접근 계층 (`inquiries` · `inquiry_replies`).
 *
 * 최종 방어선은 RLS 다(`inquiries_select_own` · `inquiry_replies_select_owner`).
 * 그런데도 모든 질의에 `user_id` 조건을 함께 거는 이유는 관리자 세션 때문이다 —
 * 관리자에게는 전체 조회가 열려 있어서 조건을 빼면 "내 문의 내역" 화면이 남의
 * 문의까지 그리게 된다.
 *
 * 그래서 사용자 id 는 인자로 받는다. 화면이 이미 로그인 여부를 판정하면서 읽은
 * 값을 그대로 넘기면 `auth.getUser()` 왕복이 한 번으로 끝난다.
 */

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const INQUIRY_LIST_COLUMNS =
  'id, inquiry_no, title, category, type, status, cancelled_at, created_at, inquiry_replies(count)'

/* prettier-ignore */
const INQUIRY_DETAIL_COLUMNS = 'id, inquiry_no, title, category, type, status, cancelled_at, created_at, account_id, content, attachments'

const REPLY_COLUMNS = 'id, author_name, content, created_at'

/**
 * 첨부 서명 URL 수명. 상세 페이지를 열어 둔 채 파일을 받는 정도면 충분하고,
 * 길게 잡을수록 유출된 링크가 오래 살아남는다.
 */
const SIGNED_URL_TTL_SECONDS = 300

type ReplyCountRow = { count: number }

type InquiryListRow = {
  id: string
  inquiry_no: number
  title: string
  category: string
  type: string
  status: InquiryStatus
  cancelled_at: string | null
  created_at: string
  inquiry_replies: readonly ReplyCountRow[]
}

/**
 * `attachments` 는 jsonb 라 타입 생성기가 `Json` 으로 내보낸다. 값의 모양은 접수
 * 시점 코드가 정하므로, 읽을 때는 모르는 형태가 섞여 있어도 화면이 죽지 않도록
 * 한 건씩 좁히고 실패한 원소는 버린다.
 */
function toAttachment(value: unknown): InquiryAttachment | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  const path = typeof record.path === 'string' ? record.path : ''

  if (path === '') {
    return null
  }

  const name = typeof record.name === 'string' && record.name !== '' ? record.name : path

  return {
    name,
    path,
    size: typeof record.size === 'number' ? record.size : 0,
    mimeType: typeof record.mimeType === 'string' ? record.mimeType : '',
  }
}

export function toAttachments(value: unknown): readonly InquiryAttachment[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map(toAttachment)
    .filter((attachment): attachment is InquiryAttachment => attachment !== null)
}

/** 임베드 집계(`inquiry_replies(count)`)는 항상 배열 한 건으로 온다. */
function toReplyCount(rows: readonly ReplyCountRow[]): number {
  return rows[0]?.count ?? 0
}

function toSummary(row: InquiryListRow): InquirySummary {
  return {
    id: row.id,
    inquiryNo: row.inquiry_no,
    title: row.title,
    category: row.category,
    type: row.type,
    status: row.status,
    cancelledAt: row.cancelled_at,
    createdAt: row.created_at,
    replyCount: toReplyCount(row.inquiry_replies),
  }
}

/**
 * 내 문의 목록(누적 "더보기", 최신순).
 *
 * 답변 수는 임베드 집계로 같은 왕복에서 받는다. 목록 10건에 대해 답변 테이블을
 * 따로 훑으면 왕복이 하나 더 늘 뿐 얻는 게 없다.
 */
export async function getMyInquiries(
  userId: string,
  page = 1,
): Promise<ListResult<InquirySummary>> {
  const supabase = await createClient()
  const { from, to } = accumulatedRange(page, INQUIRY_PAGE_SIZE)

  const { data, count, error } = await supabase
    .from('inquiries')
    .select(INQUIRY_LIST_COLUMNS, { count: 'exact' })
    .eq('user_id', userId)
    // 접수 취소한 문의는 목록에서 사라진다(오너 요청, 2026-09-11). 상세는 직접
    // 주소로만 남는다 — `getMyInquiry` 는 이 조건을 걸지 않는다.
    .is('cancelled_at', null)
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error !== null) {
    throw new Error(`문의 내역을 불러오지 못했습니다: ${error.message}`)
  }

  return toListResult(data.map(toSummary), count, page, INQUIRY_PAGE_SIZE)
}

/**
 * 문의 상세. 남의 문의는 RLS 가 막지만, 관리자 세션에서도 이 화면이 "내 문의"로
 * 남도록 `user_id` 를 명시적으로 건다. 없으면 null → 화면은 404 로 처리한다.
 */
export async function getMyInquiry(id: string, userId: string): Promise<InquiryDetail | null> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inquiries')
    .select(INQUIRY_DETAIL_COLUMNS)
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle()

  if (error !== null || data === null) {
    // uuid 가 아닌 id 는 22P02 로 떨어진다. 404 로 다룬다.
    return null
  }

  return {
    id: data.id,
    inquiryNo: data.inquiry_no,
    title: data.title,
    category: data.category,
    type: data.type,
    status: data.status,
    cancelledAt: data.cancelled_at,
    createdAt: data.created_at,
    accountId: data.account_id,
    content: data.content,
    attachments: toAttachments(data.attachments),
    /* 상세에서는 실제 답변 목록을 따로 읽으므로 개수는 그 길이로 채운다. */
    replyCount: 0,
  }
}

/**
 * 문의의 운영자 답변(오래된 순).
 *
 * 답변을 못 읽었다고 문의 본문까지 감출 이유는 없어서 오류는 빈 목록으로 삼킨다.
 */
export async function getInquiryReplies(inquiryId: string): Promise<readonly InquiryReply[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('inquiry_replies')
    .select(REPLY_COLUMNS)
    .eq('inquiry_id', inquiryId)
    .order('created_at', { ascending: true })

  if (error !== null) {
    return []
  }

  return data.map((row) => ({
    id: row.id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
  }))
}

async function signPaths(
  supabase: TypedSupabaseClient,
  paths: readonly string[],
): Promise<Map<string, string>> {
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKETS.inquiryAttachments)
    .createSignedUrls([...paths], SIGNED_URL_TTL_SECONDS)

  if (error !== null || data === null) {
    return new Map()
  }

  const signed = new Map<string, string>()

  for (const item of data) {
    if (item.error === null && typeof item.signedUrl === 'string' && item.path !== null) {
      signed.set(item.path, item.signedUrl)
    }
  }

  return signed
}

/**
 * 첨부에 서명 URL 을 붙인다.
 *
 * `inquiry-attachments` 는 비공개 버킷이라 공개 URL 이 없다. 서명은 **사용자 세션**
 * 클라이언트로 발급한다 — 서비스 롤을 쓰면 `inquiry_attachments_read_own`
 * (경로 첫 세그먼트 = uid) 검사가 사라져, 코드 실수 하나가 곧 남의 첨부 노출이 된다.
 */
export async function getSignedAttachments(
  attachments: readonly InquiryAttachment[],
): Promise<readonly SignedInquiryAttachment[]> {
  if (attachments.length === 0) {
    return []
  }

  const supabase = await createClient()
  const signed = await signPaths(
    supabase,
    attachments.map((attachment) => attachment.path),
  )

  return attachments.map((attachment) => ({
    ...attachment,
    url: signed.get(attachment.path) ?? null,
  }))
}
