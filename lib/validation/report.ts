import { z } from 'zod'

import {
  REPORT_DETAIL_MAX,
  REPORT_REASON_VALUES,
  REPORT_TARGET_TYPES,
} from '@/lib/constants/report'

import type { ReportReason, ReportTargetType } from '@/lib/constants/report'

/**
 * 신고 폼 검증.
 *
 * 서버 액션은 UI 를 거치지 않는 직접 POST 로도 호출되므로(Next 16 문서
 * "Server Functions are reachable via direct POST requests") 대상 종류·id 까지
 * 전부 여기서 좁힌다. 최종 방어선은 DB 의 `reports_insert_own` 정책이다.
 */

export const reportSchema = z.object({
  targetType: z.enum(REPORT_TARGET_TYPES as [ReportTargetType, ...ReportTargetType[]], {
    message: '잘못된 신고 대상입니다.',
  }),
  targetId: z.uuid({ message: '잘못된 신고 대상입니다.' }),
  reason: z.enum(REPORT_REASON_VALUES as [ReportReason, ...ReportReason[]], {
    message: '신고 사유를 선택해 주세요.',
  }),
  /* 빈 문자열은 "입력 안 함"이다. null 로 바꿔 DB 의 nullable 컬럼과 모양을 맞춘다. */
  detail: z
    .string()
    .trim()
    .max(REPORT_DETAIL_MAX, { message: `상세 내용은 ${REPORT_DETAIL_MAX}자 이하로 입력해 주세요.` })
    .transform((value) => (value === '' ? null : value)),
})

export type ReportInput = z.infer<typeof reportSchema>
