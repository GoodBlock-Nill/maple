import { cn } from '@/lib/utils/cn'
import { COUPON_STATUS_CLASS, COUPON_STATUS_LABEL } from '@/lib/utils/coupon-result'

import type { CouponRedemptionStatus } from '@/lib/utils/coupon-result'

/**
 * 등록 내역 상태 배지 — 문의내역 표의 배지와 같은 기하(rounded 5 · padding 5/10 ·
 * Medium 17)를 쓴다. 두 표가 같은 카드 폭 안에 서므로 모양이 갈리면 상태라는
 * 낱말의 뜻도 함께 갈린다.
 *
 * `size="sm"` 은 카드 머리의 범례와 폰 카드용이다. 색 규칙은 그대로 두고 크기만 내린다.
 */
export function CouponStatusBadge({
  status,
  size = 'md',
}: {
  status: CouponRedemptionStatus
  size?: 'sm' | 'md'
}) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-[5px] leading-none font-medium whitespace-nowrap',
        size === 'md'
          ? 'px-[10px] py-[5px] text-[15px] sm:text-[17px]'
          : 'px-2 py-[4px] text-[13px] sm:text-[14px]',
        COUPON_STATUS_CLASS[status],
      )}
    >
      {COUPON_STATUS_LABEL[status]}
    </span>
  )
}
