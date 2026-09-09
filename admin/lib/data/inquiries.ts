import 'server-only'

import {
  signInquiryAttachments,
  toAttachments,
  type InquiryAttachment,
} from '@/lib/data/inquiry-attachments'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange } from '@/lib/utils/table-query'
import { INQUIRY_STATUS_TABS, statusesForTab } from '@/lib/validation/inquiries'

import type { InquiryFilters, InquiryStatus, InquiryStatusTab } from '@/lib/validation/inquiries'

/**
 * 1:1 문의 조회 계층.
 *
 * 전부 **세션 클라이언트**로 읽는다. `inquiries_select_admin` · `inquiry_replies_admin_all`
 * 정책이 관리자에게만 전체 조회를 열어 두므로, 권한이 사라지면 화면도 함께 비는 것이
 * 정상이다 — 서비스 롤로 읽으면 그 검증이 통째로 사라진다.
 */

/* 목록은 본문(content)을 읽지 않는다 — 20건의 긴 본문은 화면에 쓰이지도 않으면서
   응답만 키운다. 검색은 서버 쪽 ilike 로 하므로 본문이 없어도 된다. */
/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const LIST_COLUMNS = 'id, title, account_id, category, type, status, cancelled_at, created_at, updated_at, user_id, author:profiles!inquiries_user_id_fkey(nickname), inquiry_replies(count)'

/* prettier-ignore */
const DETAIL_COLUMNS = 'id, title, content, account_id, category, type, status, contact_email, attachments, answered_at, cancelled_at, created_at, updated_at, user_id, author:profiles!inquiries_user_id_fkey(nickname, email)'

const REPLY_COLUMNS = 'id, author_id, author_name, content, created_at'

export type InquiryListItem = {
  id: string
  title: string
  nickname: string
  accountId: string | null
  userId: string | null
  category: string
  type: string
  status: InquiryStatus
  /** 사용자가 접수를 취소한 시각. 상태가 closed 이면서 이 값이 있으면 '접수 취소'다. */
  cancelledAt: string | null
  replyCount: number
  createdAt: string
  updatedAt: string
}

export type InquiryListResult = {
  rows: readonly InquiryListItem[]
  count: number
  /** 조회가 깨졌는지. `true` 면 `rows` 가 비어도 "데이터 없음"이 아니다(빈 표 오독 방지). */
  hasError: boolean
}

/** 첨부는 별도 모듈이 소유한다. 화면이 한곳에서 가져다 쓰도록 타입만 다시 내보낸다. */
export type { InquiryAttachment }

export type InquiryDetail = {
  id: string
  title: string
  content: string
  accountId: string | null
  category: string
  type: string
  status: InquiryStatus
  contactEmail: string | null
  answeredAt: string | null
  cancelledAt: string | null
  createdAt: string
  updatedAt: string
  userId: string | null
  nickname: string
  email: string | null
  attachments: readonly InquiryAttachment[]
}

export type InquiryReplyItem = {
  id: string
  authorName: string
  content: string
  createdAt: string
}

/** 상태 탭 옆에 붙는 건수. 상태 외의 필터(카테고리·검색·기간)는 그대로 적용된 값이다. */
export type InquiryTabCounts = Record<InquiryStatusTab, number>

/* 빌더 타입을 그대로 받으면 supabase-js 내부 제네릭에 묶인다. 쓰는 메서드만
   구조적으로 요구한다(각 메서드가 자기 자신을 돌려주는 빌더 규약). */
type FilterableQuery<TSelf> = {
  eq: (column: string, value: string) => TSelf
  gte: (column: string, value: string) => TSelf
  lt: (column: string, value: string) => TSelf
  in: (column: string, values: readonly string[]) => TSelf
  not: (column: string, operator: string, value: null) => TSelf
  or: (filters: string) => TSelf
}

const KST_OFFSET = '+09:00'

/** `YYYY-MM-DD`(한국시간) → UTC ISO. 기간 필터는 KST 자정을 경계로 잡는다. */
function kstDayBoundary(day: string, dayOffset = 0): string {
  const base = new Date(`${day}T00:00:00${KST_OFFSET}`)

  return new Date(base.getTime() + dayOffset * 24 * 60 * 60 * 1000).toISOString()
}

function applyCommonFilters<TQuery extends FilterableQuery<TQuery>>(
  query: TQuery,
  filters: InquiryFilters,
): TQuery {
  let next = query

  if (filters.cancelledOnly) {
    // 취소 판정은 사용자 사이트와 같다 — cancelled_at 하나만 본다.
    next = next.not('cancelled_at', 'is', null)
  }

  if (filters.category !== null) {
    next = next.eq('category', filters.category)
  }

  if (filters.search !== null) {
    // 검색어는 parseInquiryFilters 가 이미 or() 문법·LIKE 와일드카드를 걷어냈다.
    next = next.or(
      `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%,account_id.ilike.%${filters.search}%`,
    )
  }

  if (filters.from !== null) {
    next = next.gte('created_at', kstDayBoundary(filters.from))
  }

  if (filters.to !== null) {
    // 종료일은 그날 24시까지 포함해야 한다("~까지"를 자정 이전으로 읽으면 하루가 빈다).
    next = next.lt('created_at', kstDayBoundary(filters.to, 1))
  }

  return next
}

/** 임베드 집계(`inquiry_replies(count)`)는 항상 배열 한 건으로 온다. */
function toReplyCount(rows: readonly { count: number }[]): number {
  return rows[0]?.count ?? 0
}

export const INQUIRY_SORT_KEYS = ['created_at', 'updated_at', 'status', 'title'] as const

export async function getInquiries(
  filters: InquiryFilters,
  options: { page: number; sortKey: string; ascending: boolean },
): Promise<InquiryListResult> {
  const supabase = await createClient()
  const [from, to] = pageRange(options.page, DEFAULT_PAGE_SIZE)

  const base = supabase
    .from('inquiries')
    .select(LIST_COLUMNS, { count: 'exact' })
    .in('status', [...filters.statuses])

  const { data, count, error } = await applyCommonFilters(base, filters)
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
    title: row.title,
    // 탈퇴 등으로 user_id 가 끊긴 문의도 목록에서 사라지면 안 된다.
    nickname: row.author?.nickname ?? '(탈퇴한 회원)',
    accountId: row.account_id,
    userId: row.user_id,
    category: row.category,
    type: row.type,
    status: row.status,
    cancelledAt: row.cancelled_at,
    replyCount: toReplyCount(row.inquiry_replies),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return { rows, count: count ?? 0, hasError: false }
}

/* 탭별 건수. `head: true` 라 행을 가져오지 않고(응답 0바이트), 탭 수만큼의 왕복은
   서로 의존하지 않으므로 한 번에 던진다. 상태 외의 필터는 목록과 같은 조건을 써야
   탭의 숫자와 표의 내용이 어긋나지 않는다. */
export async function getInquiryTabCounts(filters: InquiryFilters): Promise<InquiryTabCounts> {
  const supabase = await createClient()

  const entries = await Promise.all(
    INQUIRY_STATUS_TABS.map(async (tab) => {
      const base = supabase
        .from('inquiries')
        .select('id', { count: 'exact', head: true })
        .in('status', [...statusesForTab(tab.value)])

      const { count, error } = await applyCommonFilters(base, {
        ...filters,
        cancelledOnly: tab.cancelledOnly === true,
      })

      return [tab.value, error === null ? (count ?? 0) : 0] as const
    }),
  )

  return Object.fromEntries(entries) as InquiryTabCounts
}

export async function getInquiryDetail(id: string): Promise<InquiryDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('inquiries')
    .select(DETAIL_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error !== null || data === null) {
    // uuid 가 아닌 id 는 22P02 로 떨어진다. 화면은 404 로 다룬다.
    return null
  }

  const author = data.author as { nickname: string; email: string | null } | null

  return {
    id: data.id,
    title: data.title,
    content: data.content,
    accountId: data.account_id,
    category: data.category,
    type: data.type,
    status: data.status,
    contactEmail: data.contact_email,
    answeredAt: data.answered_at,
    cancelledAt: data.cancelled_at,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    userId: data.user_id,
    nickname: author?.nickname ?? '(탈퇴한 회원)',
    email: author?.email ?? null,
    attachments: await signInquiryAttachments(toAttachments(data.attachments)),
  }
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

  return (data ?? []).map((row) => ({
    id: row.id,
    authorName: row.author_name,
    content: row.content,
    createdAt: row.created_at,
  }))
}
