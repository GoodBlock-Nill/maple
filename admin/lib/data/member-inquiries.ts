import 'server-only'

import { ACTIVITY_LIMIT } from '@/lib/data/members'
import { createClient } from '@/lib/supabase/server'
import { toInquirySource } from '@/lib/validation/inquiries'

import type { InquiryStatus, InquirySource } from '@/lib/validation/inquiries'

/**
 * 회원 상세의 "1:1 문의" 탭 데이터.
 *
 * 총 건수는 회원 상세가 이미 `getMemberActivity()`(`inquiries` 를 `user_id` 로
 * `head: true` 집계)로 세어 둔 값을 그대로 쓴다 — 여기서 따로 세면 같은 질의를
 * 두 번 보내는 데다, 조건이 한 글자라도 어긋나면 지표 카드와 탭의 숫자가
 * 갈린다. 이 모듈은 최근 `ACTIVITY_LIMIT`건의 행만 읽는다(게시글·댓글 탭과
 * 같은 한도).
 */

/* prettier-ignore */
const MEMBER_INQUIRY_COLUMNS = 'id, inquiry_no, title, category, type, status, cancelled_at, source, created_at, inquiry_replies(count)'

export type MemberInquirySummary = {
  id: string
  inquiryNo: number
  title: string
  category: string
  type: string
  status: InquiryStatus
  cancelledAt: string | null
  source: InquirySource
  replyCount: number
  createdAt: string
}

export type MemberInquiryResult = {
  rows: readonly MemberInquirySummary[]
  /** 조회가 깨졌는지. `true` 면 `rows` 가 비어도 "문의 없음"이 아니다(빈 표 오독 방지). */
  hasError: boolean
}

/** 임베드 집계(`inquiry_replies(count)`)는 항상 배열 한 건으로 온다. */
function toReplyCount(rows: readonly { count: number }[]): number {
  return rows[0]?.count ?? 0
}

export async function getMemberInquiries(memberId: string): Promise<MemberInquiryResult> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inquiries')
    .select(MEMBER_INQUIRY_COLUMNS)
    .eq('user_id', memberId)
    .order('created_at', { ascending: false })
    .limit(ACTIVITY_LIMIT)

  if (error !== null) {
    console.error('[member-inquiries] 조회 실패', error.message)

    return { rows: [], hasError: true }
  }

  return {
    rows: (data ?? []).map((row) => ({
      id: row.id,
      inquiryNo: row.inquiry_no,
      title: row.title,
      category: row.category,
      type: row.type,
      status: row.status,
      cancelledAt: row.cancelled_at,
      source: toInquirySource(row.source),
      replyCount: toReplyCount(row.inquiry_replies),
      createdAt: row.created_at,
    })),
    hasError: false,
  }
}
