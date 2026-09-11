import 'server-only'

import { hasEmailAuthFailure } from '@/lib/data/inquiry-email'
import { applyInquiryFilters } from '@/lib/data/inquiry-filters'
import { toAdminRef, toEditingRef } from '@/lib/data/inquiry-refs'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange } from '@/lib/utils/table-query'
import { INQUIRY_STATUS_TABS, statusesForTab, toInquirySource } from '@/lib/validation/inquiries'

import type { InquiryAttachment } from '@/lib/data/inquiry-attachments'
import type { InquiryEmailAuth } from '@/lib/data/inquiry-email'
import type { InquiryAdminRef, InquiryEditingRef } from '@/lib/data/inquiry-refs'
import type {
  InquiryFilters,
  InquirySource,
  InquiryStatus,
  InquiryStatusTab,
} from '@/lib/validation/inquiries'

/**
 * 1:1 문의 조회 계층.
 *
 * 전부 **세션 클라이언트**로 읽는다. `inquiries_select_admin` · `inquiry_replies_admin_all`
 * 정책이 관리자에게만 전체 조회를 열어 두므로, 권한이 사라지면 화면도 함께 비는 것이
 * 정상이다 — 서비스 롤로 읽으면 그 검증이 통째로 사라진다.
 */

/* 목록은 본문(content)을 읽지 않는다 — 20건의 긴 본문은 화면에 쓰이지도 않으면서
   응답만 키운다. 검색은 서버 쪽 ilike 로 하므로 본문이 없어도 된다. */
/* 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
/* prettier-ignore */
const LIST_COLUMNS = 'id, inquiry_no, title, account_id, category, type, status, cancelled_at, created_at, updated_at, user_id, source, email_from, email_auth, assigned_to, editing_by, editing_at, author:profiles!inquiries_user_id_fkey(nickname), assignee:profiles!inquiries_assigned_to_fkey(id, nickname), editor:profiles!inquiries_editing_by_fkey(id, nickname), inquiry_replies(count)'

export type InquiryListItem = {
  id: string
  /** 사람이 부르는 접수번호(표기는 `#1024`). 사용자 화면과 같은 값이다. */
  inquiryNo: number
  title: string
  nickname: string
  accountId: string | null
  userId: string | null
  category: string
  type: string
  status: InquiryStatus
  /** 사용자가 접수를 취소한 시각. 상태가 closed 이면서 이 값이 있으면 '접수 취소'다. */
  cancelledAt: string | null
  source: InquirySource
  /** 이메일 문의의 발신자 주소. 목록에서 계정 대신 이 값을 보여 준다. */
  emailFrom: string | null
  /** SPF · DKIM · DMARC 중 하나라도 실패. 목록에 '인증 실패' 뱃지를 세운다. */
  emailAuthFailed: boolean
  replyCount: number
  createdAt: string
  updatedAt: string
  /** 담당 운영자. null 이면 '미배정'이다. */
  assignee: InquiryAdminRef | null
  /** 지금 답변을 쓰고 있는 운영자(살아 있는 잠금일 때만 채운다). */
  editing: InquiryEditingRef | null
}

export type InquiryListResult = {
  rows: readonly InquiryListItem[]
  count: number
  /** 조회가 깨졌는지. `true` 면 `rows` 가 비어도 "데이터 없음"이 아니다(빈 표 오독 방지). */
  hasError: boolean
}

/* 첨부 · 스레드 · 이메일 인증은 별도 모듈이 소유한다. 화면이 한곳(`@/lib/data/inquiries`)에서
   가져다 쓰도록 여기서 다시 내보낸다 — 기존 임포트 경로가 그대로 동작한다. */
export type { InquiryAttachment }
export type { InquiryEmailAuth }
export { hasEmailAuthFailure, parseEmailAuth } from '@/lib/data/inquiry-email'
export { getInquiryReplies } from '@/lib/data/inquiry-replies'
/* 상세 조회는 `inquiry-detail.ts` 가 갖는다(이 파일의 300줄 상한). 화면은 계속
   `@/lib/data/inquiries` 한 곳에서 가져다 쓴다. */
export { getInquiryDetail } from '@/lib/data/inquiry-detail'
export type { InquiryAdminRef, InquiryEditingRef } from '@/lib/data/inquiry-refs'
export type { InquiryDetail } from '@/lib/data/inquiry-detail'
export type {
  InquiryReplyDeliveryStatus,
  InquiryReplyDirection,
  InquiryReplyItem,
} from '@/lib/data/inquiry-replies'

/** 상태 탭 옆에 붙는 건수. 상태 외의 필터(카테고리·검색·기간)는 그대로 적용된 값이다. */
export type InquiryTabCounts = Record<InquiryStatusTab, number>

/** 임베드 집계(`inquiry_replies(count)`)는 항상 배열 한 건으로 온다. */
function toReplyCount(rows: readonly { count: number }[]): number {
  return rows[0]?.count ?? 0
}

export const INQUIRY_SORT_KEYS = ['created_at', 'updated_at', 'status', 'title'] as const

export async function getInquiries(
  filters: InquiryFilters,
  /** `viewerId` 는 '내 담당' 필터가 가리키는 사람이다(= 지금 보고 있는 관리자). */
  options: { page: number; sortKey: string; ascending: boolean; viewerId: string | null },
): Promise<InquiryListResult> {
  const supabase = await createClient()
  const [from, to] = pageRange(options.page, DEFAULT_PAGE_SIZE)

  const base = supabase
    .from('inquiries')
    .select(LIST_COLUMNS, { count: 'exact' })
    .in('status', [...filters.statuses])

  const { data, count, error } = await applyInquiryFilters(base, filters, options.viewerId)
    .order(options.sortKey, { ascending: options.ascending })
    // 같은 시각의 행이 페이지마다 흔들리지 않도록 안정 정렬용 2차 키를 둔다.
    .order('id', { ascending: true })
    .range(from, to)

  if (error !== null) {
    console.error('[inquiries] 목록 조회 실패', error.message)

    return { rows: [], count: 0, hasError: true }
  }

  const rows: readonly InquiryListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    inquiryNo: row.inquiry_no,
    title: row.title,
    // 탈퇴 등으로 user_id 가 끊긴 문의도 목록에서 사라지면 안 된다.
    nickname: row.author?.nickname ?? '(탈퇴한 회원)',
    accountId: row.account_id,
    userId: row.user_id,
    category: row.category,
    type: row.type,
    status: row.status,
    cancelledAt: row.cancelled_at,
    source: toInquirySource(row.source),
    emailFrom: row.email_from,
    emailAuthFailed: hasEmailAuthFailure(row.email_auth),
    replyCount: toReplyCount(row.inquiry_replies),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    assignee: toAdminRef(row.assigned_to, row.assignee),
    editing: toEditingRef(row.editing_by, row.editing_at, row.editor),
  }))

  return { rows, count: count ?? 0, hasError: false }
}

/* 탭별 건수. `head: true` 라 행을 가져오지 않고(응답 0바이트), 탭 수만큼의 왕복은
   서로 의존하지 않으므로 한 번에 던진다. 상태 외의 필터는 목록과 같은 조건을 써야
   탭의 숫자와 표의 내용이 어긋나지 않는다. */
export async function getInquiryTabCounts(
  filters: InquiryFilters,
  viewerId: string | null,
): Promise<InquiryTabCounts> {
  const supabase = await createClient()

  const entries = await Promise.all(
    INQUIRY_STATUS_TABS.map(async (tab) => {
      const base = supabase
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .in('status', [...statusesForTab(tab.value)])

      const { count, error } = await applyInquiryFilters(
        base,
        { ...filters, cancelledOnly: tab.cancelledOnly === true },
        viewerId,
      )

      return [tab.value, error === null ? (count ?? 0) : 0] as const
    }),
  )

  return Object.fromEntries(entries) as InquiryTabCounts
}
