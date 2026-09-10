import Link from 'next/link'

import { cn } from '@/lib/utils/cn'
import { buildHref, type QueryParams } from '@/lib/utils/table-query'
import { REDEMPTION_TABS } from '@/lib/validation/coupon-redemptions'

import type { CouponRedemptionCounts } from '@/lib/data/coupons'
import type { CouponRedemptionStatus } from '@/lib/validation/coupon-redemptions'

/**
 * 등록 내역 상태 탭.
 *
 * 목록 필터와 달리 건수를 함께 보여 준다. 상세로 들어온 운영자가 가장 먼저 알아야
 * 하는 것이 "아직 몇 건 남았나"이고, 그 숫자는 쿠폰 하나 분량이라 집계가 싸다.
 * 쿼리 키는 `rstatus` 다 — 쿠폰 목록의 `status`(쿠폰 상태)와 뜻이 달라 이름을 나눈다.
 */
export function RedemptionTabs({
  couponId,
  params,
  active,
  counts,
}: {
  couponId: string
  params: QueryParams
  active: CouponRedemptionStatus | null
  counts: CouponRedemptionCounts
}) {
  return (
    <nav aria-label="등록 상태" className="flex flex-wrap gap-1.5">
      {REDEMPTION_TABS.map((tab) => {
        const value = tab.value === 'all' ? null : tab.value
        const isActive = value === active

        return (
          <Link
            key={tab.value}
            href={buildHref(`/coupons/${couponId}`, params, { rstatus: value, page: null })}
            aria-current={isActive ? 'page' : undefined}
            className={cn(
              'rounded-pill inline-flex items-center gap-1.5 border px-3 py-1.5 text-[13px] font-semibold',
              'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
              isActive
                ? 'border-accent bg-accent text-white'
                : 'border-line bg-surface text-muted hover:text-ink hover:bg-page',
            )}
          >
            {tab.label}
            <span className={cn('text-[12px]', isActive ? 'text-white/80' : 'text-muted')}>
              {counts[tab.value]}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
