import type { Enums } from '@/lib/supabase/types'

/** `report_reason` enum 값. DB enum 과 항상 같은 집합을 유지해야 한다. */
export type ReportReason = Enums<'report_reason'>

/** 신고 대상 종류. `reports.target_type` 의 check 제약과 1:1 대응한다. */
export type ReportTargetType = 'post' | 'comment'

export type ReportReasonOption = {
  value: ReportReason
  label: string
}

/** 라디오 그룹 순서 = 신고 다이얼로그 노출 순서. */
export const REPORT_REASONS = [
  { value: 'spam', label: '스팸·광고' },
  { value: 'abuse', label: '욕설·비방' },
  { value: 'obscene', label: '음란·불쾌' },
  { value: 'privacy', label: '개인정보 노출' },
  { value: 'other', label: '기타' },
] as const satisfies readonly ReportReasonOption[]

export const REPORT_REASON_VALUES = REPORT_REASONS.map((reason) => reason.value)

/* `as const` 로 굳히면 zod 의 `[T, ...T[]]` 로 좁힐 수 없다(readonly 튜플). */
export const REPORT_TARGET_TYPES: ReportTargetType[] = ['post', 'comment']

/** `reports.detail` 의 check 제약(char_length <= 500)과 같은 값이어야 한다. */
export const REPORT_DETAIL_MAX = 500

/** 대상별 안내 문구. 신고 다이얼로그 제목과 중복 신고 안내에 함께 쓴다. */
export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = {
  post: '게시글',
  comment: '댓글',
}

export const REPORT_SUCCESS_MESSAGE = '신고가 접수되었습니다. 검토 후 운영정책에 따라 처리됩니다.'

export const REPORT_SELF_MESSAGE = '본인이 작성한 글은 신고할 수 없습니다.'

export const REPORT_FAILURE_MESSAGE = '신고를 접수하지 못했습니다. 잠시 후 다시 시도해 주세요.'

export function duplicateReportMessage(targetType: ReportTargetType): string {
  return `이미 신고한 ${REPORT_TARGET_LABEL[targetType]}입니다.`
}
