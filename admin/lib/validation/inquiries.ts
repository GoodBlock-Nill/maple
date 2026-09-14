import { z } from 'zod'

import { isInquiryKind, type InquiryKind } from '@/lib/constants/inquiry-kind'
import { firstValue, type QueryParams } from '@/lib/utils/table-query'
import { parseInquiryAssigneeParams } from '@/lib/validation/inquiry-assignment'
import {
  parseInquiryAwaitingParam,
  parseInquiryDateParam,
  parseInquiryUserIdParam,
  sanitizeInquiryCategory,
  sanitizeInquirySearch,
  sanitizeInquiryType,
} from '@/lib/validation/inquiry-filter-values'
import { parseInquiryNoSearch } from '@/lib/validation/inquiry-no-search'
import { isInquirySource } from '@/lib/validation/inquiry-source'
import { plainTextField } from '@/lib/validation/plain-text'

import type { Enums } from '@/lib/supabase/types'
import type { InquiryAssigneeFilter } from '@/lib/validation/inquiry-assignment'
import type { InquirySource } from '@/lib/validation/inquiry-source'

/**
 * 홈페이지 문의 화면의 입력 계약 — 상태 전이 · 목록 필터 · 답변 폼.
 *
 * 서버 액션은 클라이언트 검증을 신뢰하지 않고 여기서 다시 파싱한다. 상태 전이는
 * 화면(select 옵션)과 액션이 **같은 표**를 보고 판단해야 "화면에는 없는데 직접
 * POST 하면 통과하는" 구멍이 생기지 않는다.
 *
 * 출처(웹 · 이메일)는 의존성 없는 `inquiry-source.ts` 가 갖고 여기서 다시 내보낸다 —
 * 기존 임포트 경로를 그대로 쓰게 하면서 이 파일의 300줄 상한을 지키기 위해서다.
 */

export * from '@/lib/validation/inquiry-source'
/* 계정 마스킹과 평문 필드 조각도 각자의 파일이 갖는다(이 파일의 300줄 상한). 화면과
   스키마는 계속 `@/lib/validation/inquiries` 한 곳에서 가져다 쓴다. */
export * from '@/lib/validation/inquiry-account-mask'
/* 필터 값(검색어 · 카테고리 · 유형 · 기간 · 회원 · 회원 답장)의 정리 규칙도 마찬가지다. */
export * from '@/lib/validation/inquiry-filter-values'
export * from '@/lib/validation/plain-text'

export type InquiryStatus = Enums<'inquiry_status'>

export const INQUIRY_STATUS_VALUES = [
  'pending',
  'in_progress',
  'answered',
  'closed',
] as const satisfies readonly InquiryStatus[]

/** 사용자 사이트(`/support/inquiries`)와 같은 문구를 쓴다 — 운영자와 사용자가 다른 말을 보면 문의가 늘어난다. */
export const INQUIRY_STATUS_LABELS: Record<InquiryStatus, string> = {
  pending: '접수 대기',
  in_progress: '처리 중',
  answered: '답변 완료',
  closed: '종료',
}

/**
 * 사용자가 스스로 접수를 취소한 문의의 표시 문구.
 *
 * DB 에 별도 상태 값은 없다 — 취소는 `status = 'closed'` + `cancelled_at is not null`
 * 로 표현된다(사용자 사이트 규약). 운영자에게는 "운영자가 종료한 문의"와 구분해
 * 보여 줘야 하므로 표시 계층에서만 한 단계 더 나눈다.
 */
export const INQUIRY_CANCELLED_LABEL = '접수 취소'

/**
 * 판정 기준은 `cancelled_at` **하나뿐**이다 — 사용자 사이트의
 * `resolveInquiryStatus()` 와 같은 규칙이라야 같은 문의가 두 화면에서 다른 상태로
 * 보이지 않는다(취소는 `status='closed'` 와 함께 기록되지만, 라벨은 취소가 우선한다).
 */
export function isCancelledInquiry(cancelledAt: string | null | undefined): boolean {
  return typeof cancelledAt === 'string' && cancelledAt !== ''
}

/**
 * 허용 상태 전이.
 *
 * 되돌리기는 "종료 → 처리 중" 하나만 연다. 답변 완료를 접수 대기로 되돌리는 길을
 * 열어 두면 사용자 화면의 상태가 앞뒤로 튀어 "답변이 사라졌다"는 문의를 부른다.
 *
 * **`answered → in_progress` 가 없는 것은 오너 확정 규칙이다**(2026-09-14,
 * `docs/reference/inquiry-thread-spec.md` §1). 회원 답장은 '처리 중'에서만 열리므로
 * 이 표의 빈칸이 곧 "답변 완료 = 대화가 닫힌다"는 뜻이다. 여기에 전이를 하나 더 열면
 * 답변 폼의 안내 문구(`InquiryReplyFooter`)가 거짓말이 된다 — 함께 고쳐야 한다.
 */
export const INQUIRY_STATUS_TRANSITIONS: Record<InquiryStatus, readonly InquiryStatus[]> = {
  pending: ['in_progress', 'answered', 'closed'],
  in_progress: ['answered', 'closed'],
  answered: ['closed'],
  closed: ['in_progress'],
}

export function isInquiryStatus(value: string | null | undefined): value is InquiryStatus {
  return typeof value === 'string' && (INQUIRY_STATUS_VALUES as readonly string[]).includes(value)
}

/** 같은 상태로의 "전이"는 전이가 아니다 — 호출부가 무변경을 따로 다루게 한다. */
export function canTransitionInquiryStatus(from: InquiryStatus, to: InquiryStatus): boolean {
  return INQUIRY_STATUS_TRANSITIONS[from].includes(to)
}

/* -------------------------------------------------------------------------
 * 목록 필터 (URL 상태)
 * ---------------------------------------------------------------------- */

export type InquiryStatusTab = 'open' | InquiryStatus | 'cancelled' | 'all'

export type InquiryStatusTabOption = {
  value: InquiryStatusTab
  label: string
  statuses: readonly InquiryStatus[]
  /** `cancelled_at` 이 찍힌 문의(= 사용자가 접수를 취소한 문의)만 추린다. */
  cancelledOnly?: boolean
}

/** 기본 탭은 "미처리"다. 운영자가 매일 여는 화면에서 이미 끝난 문의가 먼저 보일 이유가 없다. */
export const DEFAULT_INQUIRY_STATUS_TAB: InquiryStatusTab = 'open'

export const INQUIRY_STATUS_TABS: readonly InquiryStatusTabOption[] = [
  { value: 'open', label: '미처리', statuses: ['pending', 'in_progress'] },
  { value: 'pending', label: INQUIRY_STATUS_LABELS.pending, statuses: ['pending'] },
  { value: 'in_progress', label: INQUIRY_STATUS_LABELS.in_progress, statuses: ['in_progress'] },
  { value: 'answered', label: INQUIRY_STATUS_LABELS.answered, statuses: ['answered'] },
  { value: 'closed', label: INQUIRY_STATUS_LABELS.closed, statuses: ['closed'] },
  /* 취소분은 상태로 좁히지 않는다 — 사용자 사이트가 cancelled_at 만 보고 라벨을
     정하므로, 여기서 closed 로 한정하면 두 화면의 집계가 어긋날 수 있다. */
  {
    value: 'cancelled',
    label: INQUIRY_CANCELLED_LABEL,
    statuses: INQUIRY_STATUS_VALUES,
    cancelledOnly: true,
  },
  { value: 'all', label: '전체', statuses: INQUIRY_STATUS_VALUES },
]

export function parseInquiryStatusTab(raw: string | string[] | undefined): InquiryStatusTab {
  const value = firstValue(raw)
  const match = INQUIRY_STATUS_TABS.find((tab) => tab.value === value)

  return match?.value ?? DEFAULT_INQUIRY_STATUS_TAB
}

export function statusesForTab(tab: InquiryStatusTab): readonly InquiryStatus[] {
  const match = INQUIRY_STATUS_TABS.find((option) => option.value === tab)

  return match?.statuses ?? INQUIRY_STATUS_VALUES
}

export type InquiryFilters = {
  tab: InquiryStatusTab
  statuses: readonly InquiryStatus[]
  /**
   * '접수 취소' 탭에서만 true. 취소분은 그 탭에서만 보인다 — 다른 탭(종료·전체
   * 포함)은 `applyInquiryFilters` 가 `cancelled_at is null` 을 걸어 뺀다
   * (오너 요청, 2026-09-11).
   */
  cancelledOnly: boolean
  category: string | null
  /** 세부 문의 유형. 옵션은 카테고리의 subtypes + 데이터에 남은 옛 값이다. */
  type: string | null
  /** 출처 프리셋(사이드바의 '홈페이지 문의' · '이메일 문의'). null 이면 전체. */
  source: InquirySource | null
  /** 접수 종류(`?kind=`). null 이면 세 창구를 함께 본다. */
  kind: InquiryKind | null
  search: string | null
  /** 검색어가 접수번호(`1024` · `#1024`)일 때의 숫자. 번호 정확 일치를 함께 건다. */
  searchNo: number | null
  /** `YYYY-MM-DD` (한국시간 기준 날짜). 데이터 계층이 UTC 경계로 환산한다. */
  from: string | null
  to: string | null
  /** 회원 상세에서 넘어온 `?user=<id>` 필터. null 이면 전체 회원. */
  userId: string | null
  /** 담당자 필터(`?assignee=me|none|<uuid>`). `'me'` 의 실제 id 는 조회 계층이 채운다. */
  assignee: InquiryAssigneeFilter
  /**
   * '회원 답장 도착만'(`?awaiting=1`). 켜면 `user_replied_at` 이 찍힌 문의만 본다 —
   * 공이 운영자에게 넘어온 줄만 남는다(20260914000400).
   */
  awaiting: boolean
}

export function parseInquiryFilters(params: QueryParams): InquiryFilters {
  const tab = parseInquiryStatusTab(params.status)
  const category = firstValue(params.category)
  const type = firstValue(params.type)
  const source = firstValue(params.source)
  const kind = firstValue(params.kind)

  return {
    tab,
    statuses: statusesForTab(tab),
    cancelledOnly:
      INQUIRY_STATUS_TABS.find((option) => option.value === tab)?.cancelledOnly === true,
    // 라벨일 수 없는 값(빈 값 · 상한 초과)은 필터를 걸지 않는다(= 전체).
    category: sanitizeInquiryCategory(category),
    // 유형도 같은 규칙이다(빈 값 · 상한 초과 → 전체).
    type: sanitizeInquiryType(type),
    // 모르는 출처는 필터를 걸지 않는다(= 전체). 임의 문자열이 질의로 흘러가지 않게 한다.
    source: isInquirySource(source) ? source : null,
    // 종류도 같은 규칙이다 — 세 값 밖이면 전체(1:1 문의 · 버그제보 · 불법이용제보).
    kind: isInquiryKind(kind) ? kind : null,
    search: sanitizeInquirySearch(params.q),
    // 접수번호로도 찾을 수 있어야 한다 — 사용자가 불러 주는 값이 그것뿐이다.
    searchNo: parseInquiryNoSearch(params.q),
    from: parseInquiryDateParam(params.from),
    to: parseInquiryDateParam(params.to),
    userId: parseInquiryUserIdParam(params.user),
    // 회원이 답장한 문의만 보기(체크박스 하나). 켜지는 값은 '1' 뿐이다.
    awaiting: parseInquiryAwaitingParam(params.awaiting),
    // 담당자 필터의 규칙은 협업 모듈이 갖는다(`validation/inquiry-assignment.ts`).
    assignee: parseInquiryAssigneeParams(params),
  }
}

/* -------------------------------------------------------------------------
 * 폼 스키마
 * ---------------------------------------------------------------------- */

export const INQUIRY_REPLY_MAX_LENGTH = 2000

/**
 * 답변 뒤에 놓을 수 있는 상태. **첫 값이 폼의 기본값**이다.
 *
 * 기본은 처리 중 — 답변 완료는 운영자가 명시적으로 고른다. 답변 완료 후에는 회원이
 * 답장할 수 없고 재개도 없다(오너 규칙 2026-09-14). 기본값이 '답변 완료'면 손이 미끄러진
 * 한 번으로 대화가 닫히고, 회원은 같은 이야기를 새 문의로 다시 접수해야 한다.
 */
export const INQUIRY_REPLY_NEXT_STATUSES = ['in_progress', 'answered'] as const

export const inquiryReplySchema = z.object({
  inquiryId: z.uuid('문의를 찾을 수 없습니다.'),
  content: plainTextField(
    INQUIRY_REPLY_MAX_LENGTH,
    '답변 내용을 입력해 주세요.',
    `답변은 ${INQUIRY_REPLY_MAX_LENGTH}자를 넘을 수 없습니다.`,
  ),
  nextStatus: z.enum(INQUIRY_REPLY_NEXT_STATUSES),
  /** 체크되면 작성자 이름을 '운영자'로 고정한다(개인 닉네임 노출 방지). */
  useOperatorName: z.boolean(),
})

export const inquiryStatusSchema = z.object({
  inquiryId: z.uuid('문의를 찾을 수 없습니다.'),
  status: z.enum(INQUIRY_STATUS_VALUES),
})

export type InquiryReplyInput = z.infer<typeof inquiryReplySchema>
export type InquiryStatusInput = z.infer<typeof inquiryStatusSchema>
