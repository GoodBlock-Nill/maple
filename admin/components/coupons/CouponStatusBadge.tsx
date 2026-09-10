import { Badge, type BadgeTone } from '@/components/ui'
import { COUPON_STATUS_LABELS, type CouponStatus } from '@/lib/validation/coupons'

/**
 * 쿠폰 상태 뱃지.
 *
 * 넷 중 **지금 등록되는 것은 '활성' 하나뿐**이다. 나머지 셋을 모두 회색으로 두면
 * 운영자가 "왜 안 되는지"를 목록에서 읽지 못하고 상세를 열어야 한다. 그래서
 * 되돌릴 수 있는 상태(시작 전 · 비활성)와 시간이 지나 끝난 상태(기간 만료)를
 * 색으로 가른다 — 만료는 손을 대도 되살아나지 않으므로 한 단계 물러난 중립이다.
 */
const STATUS_TONE: Record<CouponStatus, BadgeTone> = {
  active: 'success',
  scheduled: 'info-blue',
  expired: 'muted',
  inactive: 'neutral',
}

export function CouponStatusBadge({ status }: { status: CouponStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{COUPON_STATUS_LABELS[status]}</Badge>
}
