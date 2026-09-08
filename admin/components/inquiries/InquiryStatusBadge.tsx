import { Badge, type BadgeTone } from '@/components/ui'
import {
  INQUIRY_CANCELLED_LABEL,
  INQUIRY_STATUS_LABELS,
  isCancelledInquiry,
  type InquiryStatus,
} from '@/lib/validation/inquiries'

/**
 * 문의 상태 뱃지.
 *
 * 색은 "운영자가 지금 손대야 하는가"를 기준으로 고른다 — 접수 대기는 주의(warn),
 * 처리 중은 강조(accent), 답변 완료는 성공, 종료·접수 취소는 중립이다.
 * 사용자가 스스로 취소한 문의는 운영자가 종료한 것과 구분해야 하므로 문구를 바꾼다.
 */
const STATUS_TONE: Record<InquiryStatus, BadgeTone> = {
  pending: 'warn',
  in_progress: 'accent',
  answered: 'success',
  closed: 'neutral',
}

export function InquiryStatusBadge({
  status,
  cancelledAt = null,
}: {
  status: InquiryStatus
  cancelledAt?: string | null
}) {
  if (isCancelledInquiry(cancelledAt)) {
    return <Badge tone="neutral">{INQUIRY_CANCELLED_LABEL}</Badge>
  }

  return <Badge tone={STATUS_TONE[status]}>{INQUIRY_STATUS_LABELS[status]}</Badge>
}
