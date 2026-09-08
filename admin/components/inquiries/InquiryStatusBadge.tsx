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
 * 색은 **사용자 화면과 같아야 한다**(`../../lib/constants/support.ts` 의
 * `INQUIRY_STATUS_MAP`). 문의는 운영자와 사용자가 같은 스레드를 보는 유일한
 * 모듈이라, 관리자에서 '처리 중'이 핑크인데 사용자에게는 파랑이면 운영자가 화면을
 * 보며 상태를 설명할 수 없다. 그래서 여기만 사용자 사이트의 tag 색을 그대로 쓴다.
 *
 *   접수 대기 회색 · 처리 중 파랑(#2e6eff/#e5efff) · 답변 완료 초록(#00b894/#e5fff1)
 *   · 종료 · 접수 취소는 한 단계 물러난 중립
 *
 * 사용자가 스스로 취소한 문의는 운영자가 종료한 것과 구분해야 하므로 문구를 바꾼다.
 */
const STATUS_TONE: Record<InquiryStatus, BadgeTone> = {
  pending: 'neutral',
  in_progress: 'info-blue',
  answered: 'success-green',
  closed: 'muted',
}

export function InquiryStatusBadge({
  status,
  cancelledAt = null,
}: {
  status: InquiryStatus
  cancelledAt?: string | null
}) {
  if (isCancelledInquiry(cancelledAt)) {
    return <Badge tone="muted">{INQUIRY_CANCELLED_LABEL}</Badge>
  }

  return <Badge tone={STATUS_TONE[status]}>{INQUIRY_STATUS_LABELS[status]}</Badge>
}
