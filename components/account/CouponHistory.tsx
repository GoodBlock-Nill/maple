import { MYPAGE_DIVIDER_CLASS, MYPAGE_LABEL_CLASS } from '@/components/account/mypage-styles'
import { cn } from '@/lib/utils/cn'
import { COUPON_STATUS_CLASS, COUPON_STATUS_LABEL, couponLabel } from '@/lib/utils/coupon-result'
import { formatDateIso } from '@/lib/utils/format-date'

import type { CouponRedemptionSummary } from '@/lib/data/coupons'

type CouponHistoryProps = {
  items: readonly CouponRedemptionSummary[]
}

/**
 * "등록한 쿠폰" — 시안에는 없는 보조 목록(스펙 §5 의 선택 항목).
 *
 * 코드와 쿠폰 이름은 비어 있을 수 있다. `coupons` 에는 일반 사용자 select 정책이
 * 없어서(코드 열거 차단) 임베드가 `null` 로 오기 때문이다. 그래서 이 목록의 기준
 * 열은 **등록일과 상태**이고, 이름·코드는 읽혔을 때만 덧붙인다.
 *
 * 한 건도 없으면 아무것도 그리지 않는다 — 빈 표를 두면 폼 아래가 공허해지고,
 * 처음 온 사용자에게 알려 줄 내용도 없다.
 */
export function CouponHistory({ items }: CouponHistoryProps) {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="flex flex-col">
      <hr className={cn(MYPAGE_DIVIDER_CLASS, 'mb-8')} />

      <h3 className={MYPAGE_LABEL_CLASS}>등록한 쿠폰</h3>

      <ul className="mt-[10px] flex flex-col">
        {items.map((item) => (
          <li
            key={item.id}
            className="border-field-line flex items-center gap-4 border-b py-3 last:border-b-0"
          >
            <span className="text-ink text-ui font-medium">
              {couponLabel(item.couponName, item.couponCode)}
            </span>
            <span className="text-ink-muted text-ui-sm">{formatDateIso(item.createdAt)}</span>
            <span
              className={cn(
                'rounded-pill ml-auto inline-flex items-center justify-center px-2.5 py-[5px] text-[15px] leading-none font-medium whitespace-nowrap',
                COUPON_STATUS_CLASS[item.status],
              )}
            >
              {COUPON_STATUS_LABEL[item.status]}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
