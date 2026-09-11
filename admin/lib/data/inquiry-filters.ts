import 'server-only'

import { resolveAssigneeId } from '@/lib/validation/inquiry-assignment'

import type { InquiryFilters } from '@/lib/validation/inquiries'

/**
 * 목록 질의에 조건을 붙이는 한 곳.
 *
 * 목록(`getInquiries`)과 탭 건수(`getInquiryTabCounts`)가 **같은 함수**를 써야 탭의
 * 숫자와 표의 내용이 어긋나지 않는다. `inquiries.ts` 에서 떼어 낸 것은 담당자 필터가
 * 붙으면서 그 파일이 300줄 상한에 닿았기 때문이다.
 */

/* 빌더 타입을 그대로 받으면 supabase-js 내부 제네릭에 묶인다. 쓰는 메서드만
   구조적으로 요구한다(각 메서드가 자기 자신을 돌려주는 빌더 규약). */
type FilterableQuery<TSelf> = {
  eq: (column: string, value: string) => TSelf
  gte: (column: string, value: string) => TSelf
  lt: (column: string, value: string) => TSelf
  in: (column: string, values: readonly string[]) => TSelf
  is: (column: string, value: null) => TSelf
  not: (column: string, operator: string, value: null) => TSelf
  or: (filters: string) => TSelf
}

const KST_OFFSET = '+09:00'

/** `YYYY-MM-DD`(한국시간) → UTC ISO. 기간 필터는 KST 자정을 경계로 잡는다. */
function kstDayBoundary(day: string, dayOffset = 0): string {
  const base = new Date(`${day}T00:00:00${KST_OFFSET}`)

  return new Date(base.getTime() + dayOffset * 24 * 60 * 60 * 1000).toISOString()
}

/**
 * @param viewerId '내 담당' 필터가 가리키는 사람(= 지금 보고 있는 관리자).
 *   null 이면 그 필터는 걸지 않는다 — 남의 큐를 "내 담당"으로 보여 주는 것보다 낫다.
 */
export function applyInquiryFilters<TQuery extends FilterableQuery<TQuery>>(
  query: TQuery,
  filters: InquiryFilters,
  viewerId: string | null,
): TQuery {
  let next = query

  if (filters.cancelledOnly) {
    // 취소 판정은 사용자 사이트와 같다 — cancelled_at 하나만 본다.
    next = next.not('cancelled_at', 'is', null)
  } else {
    /* '취소됨' 탭이 아니면 취소분을 뺀다(오너 요청, 2026-09-11) — 사용자 목록에서
       사라진 문의가 관리자의 '종료'·'전체' 탭에는 남아 있으면 두 화면의 뜻이
       어긋난다. 취소분은 오직 '취소됨' 탭에서만 감사할 수 있다. */
    next = next.is('cancelled_at', null)
  }

  if (filters.userId !== null) {
    // 회원 상세의 "전체 보기" 링크(`/inquiries?user=<id>`)가 쓰는 필터다.
    next = next.eq('user_id', filters.userId)
  }

  next = applyAssigneeFilter(next, filters, viewerId)

  if (filters.category !== null) {
    next = next.eq('category', filters.category)
  }

  if (filters.type !== null) {
    next = next.eq('type', filters.type)
  }

  if (filters.source !== null) {
    next = next.eq('source', filters.source)
  }

  if (filters.search !== null) {
    // 검색어는 parseInquiryFilters 가 이미 or() 문법·LIKE 와일드카드를 걷어냈다.
    const clauses = [
      `title.ilike.%${filters.search}%`,
      `content.ilike.%${filters.search}%`,
      `account_id.ilike.%${filters.search}%`,
      `email_from.ilike.%${filters.search}%`,
    ]

    /* 접수번호는 **정확히** 일치할 때만 건다. 숫자는 파서가 이미 검증했으므로
       질의 문법으로 해석될 문자가 남아 있지 않다. */
    if (filters.searchNo !== null) {
      clauses.push(`inquiry_no.eq.${filters.searchNo}`)
    }

    next = next.or(clauses.join(','))
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

function applyAssigneeFilter<TQuery extends FilterableQuery<TQuery>>(
  query: TQuery,
  filters: InquiryFilters,
  viewerId: string | null,
): TQuery {
  if (filters.assignee === 'all') {
    return query
  }

  if (filters.assignee === 'none') {
    return query.is('assigned_to', null)
  }

  const assigneeId = resolveAssigneeId(filters.assignee, viewerId)

  return assigneeId === null ? query : query.eq('assigned_to', assigneeId)
}
