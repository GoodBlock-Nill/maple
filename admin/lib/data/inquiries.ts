import 'server-only'

import {
  signInquiryAttachments,
  toAttachments,
  type InquiryAttachment,
} from '@/lib/data/inquiry-attachments'
import { hasEmailAuthFailure, parseEmailAuth } from '@/lib/data/inquiry-email'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange } from '@/lib/utils/table-query'
import { INQUIRY_STATUS_TABS, statusesForTab, toInquirySource } from '@/lib/validation/inquiries'

import type { InquiryEmailAuth } from '@/lib/data/inquiry-email'
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
const LIST_COLUMNS = 'id, title, account_id, category, type, status, cancelled_at, created_at, updated_at, user_id, source, email_from, email_auth, author:profiles!inquiries_user_id_fkey(nickname), inquiry_replies(count)'

/* prettier-ignore */
const DETAIL_COLUMNS = 'id, title, content, account_id, category, type, status, contact_email, attachments, answered_at, cancelled_at, created_at, updated_at, user_id, source, email_from, email_from_name, email_message_id, email_auth, email_thread_key, author:profiles!inquiries_user_id_fkey(nickname, email)'

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
  source: InquirySource
  /** 이메일 문의의 발신자 주소. 목록에서 계정 대신 이 값을 보여 준다. */
  emailFrom: string | null
  /** SPF · DKIM · DMARC 중 하나라도 실패. 목록에 '인증 실패' 뱃지를 세운다. */
  emailAuthFailed: boolean
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

/* 첨부 · 스레드 · 이메일 인증은 별도 모듈이 소유한다. 화면이 한곳(`@/lib/data/inquiries`)에서
   가져다 쓰도록 여기서 다시 내보낸다 — 기존 임포트 경로가 그대로 동작한다. */
export type { InquiryAttachment }
export type { InquiryEmailAuth }
export { hasEmailAuthFailure, parseEmailAuth } from '@/lib/data/inquiry-email'
export { getInquiryReplies } from '@/lib/data/inquiry-replies'
export type {
  InquiryReplyDeliveryStatus,
  InquiryReplyDirection,
  InquiryReplyItem,
} from '@/lib/data/inquiry-replies'

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
  source: InquirySource
  emailFrom: string | null
  emailFromName: string | null
  /** 원본 메일의 Message-ID. 답신의 In-Reply-To 로 쓰이므로 상세에 그대로 보여 준다. */
  emailMessageId: string | null
  emailAuth: InquiryEmailAuth | null
  /** `reply+<key>@` 회신 주소에 쓰는 토큰. 화면에는 노출하지 않는다. */
  emailThreadKey: string | null
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

  if (filters.source !== null) {
    next = next.eq('source', filters.source)
  }

  if (filters.search !== null) {
    // 검색어는 parseInquiryFilters 가 이미 or() 문법·LIKE 와일드카드를 걷어냈다.
    next = next.or(
      `title.ilike.%${filters.search}%,content.ilike.%${filters.search}%,account_id.ilike.%${filters.search}%,email_from.ilike.%${filters.search}%`,
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
    source: toInquirySource(row.source),
    emailFrom: row.email_from,
    emailAuthFailed: hasEmailAuthFailure(row.email_auth),
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
  const source = toInquirySource(data.source)

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
    /* 이메일 문의에는 회원이 없다(`user_id` 를 일부러 채우지 않는다 — 발신자 위조로
       회원을 사칭할 수 있어서다). '(탈퇴한 회원)'으로 보이면 운영자가 오해하므로
       발신자 이름을 대신 쓴다. */
    nickname:
      source === 'email'
        ? (data.email_from_name ?? data.email_from ?? '(발신자 없음)')
        : (author?.nickname ?? '(탈퇴한 회원)'),
    email: author?.email ?? null,
    attachments: await signInquiryAttachments(toAttachments(data.attachments)),
    source,
    emailFrom: data.email_from,
    emailFromName: data.email_from_name,
    emailMessageId: data.email_message_id,
    emailAuth: parseEmailAuth(data.email_auth),
    emailThreadKey: data.email_thread_key,
  }
}
