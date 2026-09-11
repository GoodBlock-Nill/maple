import { z } from 'zod'

import { firstValue } from '@/lib/utils/table-query'
import { plainTextField } from '@/lib/validation/plain-text'

import type { QueryParams } from '@/lib/utils/table-query'

/**
 * 1:1 문의 협업의 입력 계약 — 담당자 배정 · 작성 중 잠금 · 충돌 감지 · 내부 메모.
 *
 * 문의 본문 쪽 계약(`validation/inquiries.ts`)과 파일을 나눈 이유는 두 가지다.
 *   * 그 파일이 이미 300줄 상한에 닿아 있다.
 *   * 협업은 **운영자끼리의 규칙**이라 사용자 사이트와 공유할 것이 하나도 없다 —
 *     상태 라벨·취소 판정처럼 두 화면이 맞춰야 하는 값이 여기에는 없다.
 */

/* -------------------------------------------------------------------------
 * 목록 필터 (`?assignee=me|none|<uuid>`)
 * ---------------------------------------------------------------------- */

export const INQUIRY_ASSIGNEE_ME = 'me'
export const INQUIRY_ASSIGNEE_NONE = 'none'

/** `{ adminId }` 는 "특정 운영자 담당". `'me'` 의 실제 id 는 조회 계층이 채운다. */
export type InquiryAssigneeFilter = 'all' | 'me' | 'none' | { adminId: string }

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 담당자 필터 값 읽기.
 *
 * 모르는 값은 필터를 걸지 않는다(= 전체). uuid 모양이 아닌 문자열이 `eq()` 값으로
 * 그대로 흘러가지 않게 하는 것이 목적이다 — 목록의 다른 필터와 같은 규칙이다.
 */
export function parseInquiryAssignee(raw: string | string[] | undefined): InquiryAssigneeFilter {
  const value = firstValue(raw)

  if (value === INQUIRY_ASSIGNEE_ME || value === INQUIRY_ASSIGNEE_NONE) {
    return value
  }

  return value !== null && UUID_PATTERN.test(value) ? { adminId: value } : 'all'
}

/** 필터 → 쿼리 값. `'all'` 은 키를 아예 지운다(`buildHref` 규약: null = 제거). */
export function inquiryAssigneeParam(filter: InquiryAssigneeFilter): string | null {
  if (filter === 'all') {
    return null
  }

  return typeof filter === 'string' ? filter : filter.adminId
}

/** 필터가 가리키는 담당자 id. `'me'` 는 보는 사람, 나머지는 지정된 운영자. */
export function resolveAssigneeId(
  filter: InquiryAssigneeFilter,
  viewerId: string | null,
): string | null {
  if (filter === 'me') {
    return viewerId
  }

  return typeof filter === 'string' ? null : filter.adminId
}

export function parseInquiryAssigneeParams(params: QueryParams): InquiryAssigneeFilter {
  return parseInquiryAssignee(params.assignee)
}

/* -------------------------------------------------------------------------
 * 작성 중 소프트 락
 * ---------------------------------------------------------------------- */

/** 하트비트가 이 시간 넘게 끊기면 만료로 본다. DB(`claim_inquiry_edit`)와 같은 숫자다. */
export const INQUIRY_LOCK_TTL_MS = 5 * 60 * 1000

/** 탭이 열려 있는 동안의 잠금 갱신 주기. TTL 의 1/5 라 한 번 빠뜨려도 풀리지 않는다. */
export const INQUIRY_LOCK_HEARTBEAT_MS = 60 * 1000

/** 잠금·답변 상태를 다시 읽는 주기. 배너가 "이미 끝난 작업"을 계속 띄우지 않게 한다. */
export const INQUIRY_COLLAB_POLL_MS = 20 * 1000

/** 살아 있는 잠금인가(= 만료되지 않았는가). 화면과 액션이 같은 기준을 쓴다. */
export function isLiveLock(editingAt: string | null, now: number = Date.now()): boolean {
  if (editingAt === null) {
    return false
  }

  const at = Date.parse(editingAt)

  return !Number.isNaN(at) && now - at < INQUIRY_LOCK_TTL_MS
}

/**
 * "3분 전 활동" — 잠금이 얼마나 신선한지.
 *
 * 1분 미만은 '방금'이다. 0분이라고 적으면 "왜 0분 전이지?" 하고 멈칫하게 된다.
 */
export function lockActivityLabel(editingAt: string | null, now: number = Date.now()): string {
  if (editingAt === null) {
    return '활동 시각 없음'
  }

  const at = Date.parse(editingAt)

  if (Number.isNaN(at)) {
    return '활동 시각 없음'
  }

  const minutes = Math.floor(Math.max(0, now - at) / 60_000)

  return minutes < 1 ? '방금 활동' : `${minutes}분 전 활동`
}

/* -------------------------------------------------------------------------
 * 문구
 * ---------------------------------------------------------------------- */

/**
 * 저장 충돌.
 *
 * "먼저 처리했다"까지만 말하고 무엇을 하라고는 강하게 적지 않는다 — 작성하던 글은
 * 화면에 그대로 남아 있고, 운영자는 최신 스레드를 본 뒤 이어 쓸지 지울지 고른다.
 */
export const INQUIRY_CONFLICT_MESSAGE =
  '다른 운영자가 먼저 처리했습니다. 최신 내용을 확인해 주세요.'

export const INQUIRY_NOTE_VISIBILITY_NOTICE = '운영자 전용 · 고객에게 보이지 않습니다'

/* -------------------------------------------------------------------------
 * 폼 스키마
 * ---------------------------------------------------------------------- */

export const INQUIRY_NOTE_MAX_LENGTH = 2000

const inquiryIdField = z.uuid('문의를 찾을 수 없습니다.')

export const inquiryAssignSchema = z.object({
  inquiryId: inquiryIdField,
  assigneeId: z.uuid('담당자를 찾을 수 없습니다.'),
})

export const inquiryUnassignSchema = z.object({ inquiryId: inquiryIdField })

export const inquiryNoteSchema = z.object({
  inquiryId: inquiryIdField,
  body: plainTextField(
    INQUIRY_NOTE_MAX_LENGTH,
    '메모 내용을 입력해 주세요.',
    `메모는 ${INQUIRY_NOTE_MAX_LENGTH}자를 넘을 수 없습니다.`,
  ),
})

export const inquiryNoteDeleteSchema = z.object({
  noteId: z.uuid('메모를 찾을 수 없습니다.'),
  inquiryId: inquiryIdField,
})

export type InquiryAssignInput = z.infer<typeof inquiryAssignSchema>
export type InquiryNoteInput = z.infer<typeof inquiryNoteSchema>

/* -------------------------------------------------------------------------
 * 저장 시점 스냅샷(충돌 감지)
 * ---------------------------------------------------------------------- */

/**
 * 운영자가 화면을 연 시점의 스레드 상태.
 *
 * 폼이 hidden 으로 실어 보내고, 액션은 이 값과 지금 DB 를 비교한다. 모양이 이상하면
 * **검사를 건너뛴다** — 충돌 감지는 보안 경계가 아니라 협업 장치라, 알 수 없는
 * 호출자를 막는 것보다 저장을 잇는 편이 낫다(직접 POST · 옛 탭).
 */
export type InquirySnapshot = {
  replyCount: number | null
  status: string | null
}

export function parseInquirySnapshot(replyCount: string, status: string): InquirySnapshot {
  const parsed = Number.parseInt(replyCount, 10)

  return {
    replyCount: Number.isNaN(parsed) || parsed < 0 ? null : parsed,
    status: status === '' ? null : status,
  }
}
