import { z } from 'zod'

import { firstValue, type QueryParams } from '@/lib/utils/table-query'
import { isInquirySource } from '@/lib/validation/inquiry-source'

import type { Enums } from '@/lib/supabase/types'
import type { InquirySource } from '@/lib/validation/inquiry-source'

/**
 * 1:1 문의 화면의 입력 계약 — 상태 전이 · 목록 필터 · 답변 폼.
 *
 * 서버 액션은 클라이언트 검증을 신뢰하지 않고 여기서 다시 파싱한다. 상태 전이는
 * 화면(select 옵션)과 액션이 **같은 표**를 보고 판단해야 "화면에는 없는데 직접
 * POST 하면 통과하는" 구멍이 생기지 않는다.
 *
 * 출처(웹 · 이메일)는 의존성 없는 `inquiry-source.ts` 가 갖고 여기서 다시 내보낸다 —
 * 기존 임포트 경로를 그대로 쓰게 하면서 이 파일의 300줄 상한을 지키기 위해서다.
 */

export * from '@/lib/validation/inquiry-source'

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

/**
 * 카테고리 필터 값의 상한. DB CHECK(`inquiry_categories_label_length`)와 같은 숫자다.
 *
 * 옵션 목록은 DB(`inquiry_categories`) + 데이터에 남은 옛 라벨이라 여기서 고정 배열로
 * 검사할 수 없다. 대신 "라벨일 수 없는 값"만 걸러 낸다 — 필터는 `eq()` 로만 쓰이므로
 * 임의 문자열이 질의 문법으로 해석되지는 않지만, 길이가 상한을 넘는 값은 어떤 행과도
 * 맞지 않아 필터로서 의미가 없다.
 */
export const INQUIRY_CATEGORY_MAX_LENGTH = 20

/**
 * 유형 필터 값의 상한. DB CHECK(`inquiry_categories_subtypes_shape`)의 항목 길이와
 * 같은 숫자다. 옵션 목록은 DB(세부 유형) + 데이터에 남은 옛 값이라 고정 배열로
 * 검사할 수 없어, 카테고리와 같은 규칙으로 "유형일 수 없는 값"만 걸러 낸다.
 */
export const INQUIRY_TYPE_MAX_LENGTH = 30

export const INQUIRY_SEARCH_MAX_LENGTH = 60

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/**
 * 검색어 정리.
 *
 * PostgREST 의 `or(...)` 는 쉼표·괄호를 **문법**으로 읽고, ilike 패턴에서 `%`·`_` 는
 * 와일드카드다. 그대로 흘려보내면 검색어 하나로 질의가 깨지거나 의도치 않은
 * 전체 스캔이 된다. 서식 문자는 지우고 길이도 자른다.
 */
export function sanitizeInquirySearch(raw: string | string[] | undefined): string | null {
  const value = firstValue(raw)

  if (value === null) {
    return null
  }

  const cleaned = value
    .replace(/[,()%_*\\"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, INQUIRY_SEARCH_MAX_LENGTH)

  return cleaned === '' ? null : cleaned
}

/** 카테고리 필터 값 정리. 옵션 목록은 DB 가 소유하므로 모양만 본다. */
export function sanitizeInquiryCategory(raw: string | null): string | null {
  const value = (raw ?? '').trim()

  return value === '' || value.length > INQUIRY_CATEGORY_MAX_LENGTH ? null : value
}

/** 유형(세부 문의 유형) 필터 값 정리. 카테고리와 같은 규칙이다. */
export function sanitizeInquiryType(raw: string | null): string | null {
  const value = (raw ?? '').trim()

  return value === '' || value.length > INQUIRY_TYPE_MAX_LENGTH ? null : value
}

function parseDateParam(raw: string | string[] | undefined): string | null {
  const value = firstValue(raw)

  if (value === null || !DATE_PATTERN.test(value)) {
    return null
  }

  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? null : value
}

/* `profiles.id` 는 uuid 다. 모양이 아닌 값은 필터를 걸지 않는다(= 전체) — 회원
   상세("전체 보기")가 항상 uuid 를 실어 보내므로 실사용에서는 걸릴 일이 없고,
   임의 문자열이 `eq()` 값으로 그대로 흘러가는 것만 막으면 된다. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function parseUserIdParam(raw: string | string[] | undefined): string | null {
  const value = firstValue(raw)

  return value !== null && UUID_PATTERN.test(value) ? value : null
}

export type InquiryFilters = {
  tab: InquiryStatusTab
  statuses: readonly InquiryStatus[]
  /** '접수 취소' 탭에서만 true. 취소분은 '종료'·'전체' 탭에도 함께 보인다. */
  cancelledOnly: boolean
  category: string | null
  /** 세부 문의 유형. 옵션은 카테고리의 subtypes + 데이터에 남은 옛 값이다. */
  type: string | null
  /** 출처 프리셋(사이드바의 '1:1 문의' · '이메일 문의'). null 이면 전체. */
  source: InquirySource | null
  search: string | null
  /** `YYYY-MM-DD` (한국시간 기준 날짜). 데이터 계층이 UTC 경계로 환산한다. */
  from: string | null
  to: string | null
  /** 회원 상세에서 넘어온 `?user=<id>` 필터. null 이면 전체 회원. */
  userId: string | null
}

export function parseInquiryFilters(params: QueryParams): InquiryFilters {
  const tab = parseInquiryStatusTab(params.status)
  const category = firstValue(params.category)
  const type = firstValue(params.type)
  const source = firstValue(params.source)

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
    search: sanitizeInquirySearch(params.q),
    from: parseDateParam(params.from),
    to: parseDateParam(params.to),
    userId: parseUserIdParam(params.user),
  }
}

/* -------------------------------------------------------------------------
 * 계정 ID 마스킹
 * ---------------------------------------------------------------------- */

/* 사용자 사이트(`lib/utils/mask.ts`)와 **완전히 같은 규칙**을 쓴다. 같은 계정 ID 가
   두 화면에서 다르게 가려지면 운영자와 사용자가 같은 값을 두고 다른 이야기를 하게 된다.
   마스크 길이를 원문 길이에 맞추지 않는 것도 그쪽 결정이다 — 자릿수까지 새어 나가지
   않게 하려는 것. */
const ACCOUNT_MASK = '****'
const ACCOUNT_VISIBLE_PREFIX = 4
const ACCOUNT_VISIBLE_SUFFIX = 3

/** `123456789000000` → `1234****000`. 값이 없으면 화면이 비지 않도록 `-`. */
export function maskAccountId(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()

  if (trimmed.length === 0) {
    return '-'
  }

  if (trimmed.length <= ACCOUNT_VISIBLE_PREFIX + ACCOUNT_VISIBLE_SUFFIX) {
    return `${trimmed.slice(0, 1)}${ACCOUNT_MASK}`
  }

  return `${trimmed.slice(0, ACCOUNT_VISIBLE_PREFIX)}${ACCOUNT_MASK}${trimmed.slice(-ACCOUNT_VISIBLE_SUFFIX)}`
}

/* -------------------------------------------------------------------------
 * 폼 스키마
 * ---------------------------------------------------------------------- */

export const INQUIRY_REPLY_MAX_LENGTH = 2000

/** 답변 뒤에 놓을 수 있는 상태. 기본은 답변 완료, 추가 확인이 필요하면 처리 중. */
export const INQUIRY_REPLY_NEXT_STATUSES = ['answered', 'in_progress'] as const

/**
 * 여러 줄 평문 필드.
 *
 * 브라우저는 textarea 값을 폼 전송 시 **CRLF 로 정규화**한다(HTML 사양). 그대로
 * 저장하면 사용자 화면·검색·글자 수 계산이 보이지 않는 `\r` 에 흔들린다. 길이를
 * 재기 전에 LF 로 되돌리고 앞뒤 공백을 다듬는다.
 */
export function plainTextField(max: number, emptyMessage: string, tooLongMessage: string) {
  return z
    .string()
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .pipe(z.string().min(1, emptyMessage).max(max, tooLongMessage))
}

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
