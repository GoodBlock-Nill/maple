import { z } from 'zod'

import { SUSPENSION_PERIODS, SUSPENSION_REASON_MAX } from '@/lib/validation/members'

import type { Enums } from '@/lib/supabase/types'

/**
 * 커뮤니티 조치(숨김 · 삭제)와 신고 처리의 검증 · 표기 규칙.
 *
 * `members.ts` 와 마찬가지로 순수 모듈이다. 서버 액션과 다이얼로그가 같은 스키마를
 * 공유해야 "화면에서는 막았는데 직접 POST 는 통과하는" 구멍이 생기지 않는다.
 */

/* -------------------------------------------------------------------------- */
/* 목록 필터 정규화                                                            */
/*                                                                            */
/* 커뮤니티 · 회원 목록이 같은 규칙으로 검색어와 기간을 해석해야 한다. 조회 모듈  */
/* (`lib/data/*`)은 `server-only` 라 단위 테스트에서 불러올 수 없으므로, 순수한  */
/* 정규화 함수는 여기(검증 계층)에 둔다.                                        */
/* -------------------------------------------------------------------------- */

/**
 * `ilike` 검색 패턴.
 *
 * `%` 와 `_` 는 와일드카드다. 이스케이프하지 않으면 사용자가 입력한 `_` 하나가
 * "아무 글자 한 개"로 해석돼 엉뚱한 행이 잡힌다.
 */
export function containsPattern(value: string | null): string | null {
  if (value === null || value.trim() === '') {
    return null
  }

  return `%${value.trim().replace(/[\\%_]/g, (match) => `\\${match}`)}%`
}

/**
 * 필터의 `YYYY-MM-DD`(한국시간) → UTC ISO 경계값.
 *
 * UTC 자정으로 끊으면 오전 9시 이전 글이 전날로 밀려 운영자가 고른 기간과 화면의
 * "작성일"이 어긋난다. `offsetDays = 1` 로 종료일 다음 날 0시를 얻어 `lt` 로 쓴다.
 */
export function kstDayBoundary(day: string | null, offsetDays = 0): string | null {
  if (day === null) {
    return null
  }

  const parsed = new Date(`${day}T00:00:00+09:00`)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return new Date(parsed.getTime() + offsetDays * 24 * 60 * 60 * 1000).toISOString()
}

/* -------------------------------------------------------------------------- */
/* 게시글 · 댓글 상태                                                          */
/* -------------------------------------------------------------------------- */

export type ContentStatus = 'visible' | 'hidden' | 'deleted'

/** 조치 대상 테이블. 게시글과 댓글은 같은 두 축(is_hidden · deleted_at)으로 다룬다. */
export type ContentTable = 'posts' | 'comments'

export const CONTENT_STATUS_FILTERS = ['visible', 'hidden', 'deleted'] as const

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  visible: '정상',
  hidden: '숨김',
  deleted: '삭제',
}

/**
 * 표시 상태 판정.
 *
 * 삭제가 숨김을 이긴다. `deleted_at` 은 작성자의 삭제, `is_hidden` 은 운영 숨김이라
 * 두 값이 동시에 서 있을 수 있는데, 이때 "숨김"으로 보이면 운영자가 복구 버튼을
 * 누르고도 글이 돌아오지 않는 것처럼 느낀다.
 */
export function contentStatus(row: { isHidden: boolean; deletedAt: string | null }): ContentStatus {
  if (row.deletedAt !== null) {
    return 'deleted'
  }

  return row.isHidden ? 'hidden' : 'visible'
}

/** 커뮤니티 카테고리 키(board_categories 의 community 행). 필터 값 검증에만 쓴다. */
export const COMMUNITY_CATEGORY_KEYS = ['chat', 'question', 'info'] as const

/* -------------------------------------------------------------------------- */
/* 신고                                                                        */
/* -------------------------------------------------------------------------- */

export const REPORT_STATUSES = ['open', 'resolved', 'dismissed'] as const

export type ReportStatus = (typeof REPORT_STATUSES)[number]

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  open: '미처리',
  resolved: '처리 완료',
  dismissed: '기각',
}

/**
 * 사유 라벨.
 *
 * 사용자 사이트의 신고 다이얼로그(`lib/constants/report.ts` 의 `REPORT_REASONS`)와
 * **글자까지 같아야 한다**. 운영자가 보는 문구와 신고자가 고른 문구가 다르면
 * 문의가 들어왔을 때 같은 신고를 이야기하고 있는지 확인하는 데 시간이 든다.
 */
export const REPORT_REASON_LABEL: Record<Enums<'report_reason'>, string> = {
  spam: '스팸·광고',
  abuse: '욕설·비방',
  obscene: '음란·불쾌',
  privacy: '개인정보 노출',
  other: '기타',
}

export const REPORT_TARGET_LABEL: Record<'post' | 'comment', string> = {
  post: '게시글',
  comment: '댓글',
}

/** 신고 "처리" 시 함께 취할 조치. */
export const REPORT_ACTIONS = ['hide', 'delete', 'suspend', 'none'] as const

export type ReportAction = (typeof REPORT_ACTIONS)[number]

export const REPORT_ACTION_LABEL: Record<ReportAction, string> = {
  hide: '대상 숨김',
  delete: '대상 삭제',
  suspend: '작성자 정지',
  none: '조치 없이 처리',
}

/**
 * 처리 메모 길이.
 *
 * `reports` 에는 메모 컬럼이 없어 `audit_logs.after` 에 담는다(README 의 스키마
 * 공백 항목). 감사 로그는 jsonb 라 길이 제한이 없으므로 여기서 끊지 않으면
 * 본문 전체를 붙여 넣은 메모가 그대로 쌓인다.
 */
export const MODERATION_NOTE_MAX = 500

const noteSchema = z
  .string()
  .trim()
  .max(MODERATION_NOTE_MAX, {
    message: `메모는 ${MODERATION_NOTE_MAX}자 이하로 입력해 주세요.`,
  })

const optionalNoteSchema = noteSchema.transform((value) => (value === '' ? null : value))

const requiredNoteSchema = noteSchema.pipe(z.string().min(1, { message: '사유를 입력해 주세요.' }))

const idSchema = z.uuid({ message: '대상을 찾을 수 없습니다.' })

/* -------------------------------------------------------------------------- */
/* 스키마                                                                      */
/* -------------------------------------------------------------------------- */

/** 숨김/해제 · 삭제/복구 공통. `on` 이 true 면 숨김(또는 삭제)을 건다. */
export const toggleContentSchema = z.object({
  id: idSchema,
  on: z.enum(['0', '1']).transform((value) => value === '1'),
})

export const BULK_HIDE_MAX = 100

export const bulkHideSchema = z.object({
  ids: z
    .array(idSchema)
    .min(1, { message: '대상을 한 건 이상 선택해 주세요.' })
    .max(BULK_HIDE_MAX, { message: `한 번에 ${BULK_HIDE_MAX}건까지 처리할 수 있습니다.` }),
})

/**
 * 신고 처리.
 *
 * 정지를 고르면 기간과 사유가 함께 있어야 한다. 액션은 UI 를 거치지 않는 직접
 * POST 로도 불리므로 이 결합 규칙을 스키마에 박아 둔다.
 */
export const resolveReportSchema = z
  .object({
    reportId: idSchema,
    action: z.enum(REPORT_ACTIONS, { message: '조치를 선택해 주세요.' }),
    note: optionalNoteSchema,
    period: z.enum(SUSPENSION_PERIODS).optional(),
    /* 회원 정지 다이얼로그와 같은 상한이어야 한다 — 두 화면이 같은 컬럼을 채운다. */
    suspensionReason: z.string().trim().max(SUSPENSION_REASON_MAX).optional(),
    /** 같은 대상에 열려 있는 다른 신고까지 함께 종결한다. */
    applyToTarget: z.enum(['0', '1']).transform((value) => value === '1'),
  })
  .superRefine((value, ctx) => {
    if (value.action !== 'suspend') {
      return
    }

    if (value.period === undefined) {
      ctx.addIssue({ code: 'custom', path: ['period'], message: '정지 기간을 선택해 주세요.' })
    }

    if (value.suspensionReason === undefined || value.suspensionReason === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['suspensionReason'],
        message: '정지 사유를 입력해 주세요.',
      })
    }
  })

/** 기각은 메모를 필수로 받는다. 근거 없는 기각은 나중에 재검토할 수 없다. */
export const dismissReportSchema = z.object({
  reportId: idSchema,
  note: requiredNoteSchema,
  applyToTarget: z.enum(['0', '1']).transform((value) => value === '1'),
})

export type ResolveReportInput = z.infer<typeof resolveReportSchema>
export type DismissReportInput = z.infer<typeof dismissReportSchema>
