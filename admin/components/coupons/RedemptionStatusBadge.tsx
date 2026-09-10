import { Badge, type BadgeTone } from '@/components/ui'
import {
  COUPON_REDEMPTION_STATUS_LABELS,
  type CouponRedemptionStatus,
} from '@/lib/validation/coupon-redemptions'

/**
 * 등록 내역 상태 뱃지.
 *
 * '처리 대기'만 눈에 띄어야 한다 — 이 화면에서 운영자가 할 일은 대기 건을 0 으로
 * 만드는 것 하나이고, 끝난 건은 배경으로 물러나야 남은 일이 보인다.
 */
const STATUS_TONE: Record<CouponRedemptionStatus, BadgeTone> = {
  pending: 'warn',
  delivered: 'success-green',
  rejected: 'muted',
}

export function RedemptionStatusBadge({ status }: { status: CouponRedemptionStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{COUPON_REDEMPTION_STATUS_LABELS[status]}</Badge>
}
