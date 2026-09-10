'use client'

import { CouponHistoryDetail } from '@/components/account/CouponHistoryDetail'
import { CouponStatusBadge } from '@/components/account/CouponStatusBadge'
import { ChevronDownIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils/cn'
import { formatDateIso } from '@/lib/utils/format-date'

import type { CouponRedemption } from '@/lib/constants/coupons'

/**
 * 좁은 화면(<1024)의 등록 내역 — 표를 눕히지 않고 **한 건 = 한 장**으로 다시 짠다.
 *
 * 문의내역 표는 좁아지면 가로로 스크롤한다(열을 접으면 표의 뜻이 사라지므로).
 * 여기서는 그 선택을 뒤집는다. 이 목록에서 사용자가 하려는 일은 "내 쿠폰이 어떻게
 * 됐나" 하나이고, 그 답(쿠폰 이름 · 상태)은 한 줄에 들어간다 — 폰에서 가로로 밀어야
 * 상태가 보이는 표는 그 답을 숨기는 것과 같다.
 *
 * 표와 같은 데이터·같은 펼침 상태를 쓰고, 접힌 카드에 보이는 값도 같다.
 */
export function CouponHistoryCards({
  items,
  openId,
  onToggle,
  highlightId,
}: {
  items: readonly CouponRedemption[]
  openId: string | null
  onToggle: (id: string) => void
  highlightId: string | null
}) {
  return (
    <ul className="flex flex-col gap-[10px] lg:hidden">
      {items.map((item, index) => {
        const isOpen = openId === item.id
        const detailId = `coupon-card-detail-${item.id}`

        return (
          <li
            key={item.id}
            className={cn(
              'border-line-soft overflow-hidden rounded-[14px] border bg-white',
              highlightId === item.id && 'coupon-row-new',
            )}
          >
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              aria-expanded={isOpen}
              aria-controls={detailId}
              className="focus-visible:outline-focus flex w-full items-center gap-3 px-4 py-[14px] text-left focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
            >
              <div className="min-w-0 flex-1">
                <p className="text-ink text-ui truncate font-medium">
                  <span className="text-ink-muted mr-2 tabular-nums">{index + 1}</span>
                  {item.couponName}
                  {highlightId === item.id ? (
                    <span className="sr-only">방금 등록한 쿠폰입니다.</span>
                  ) : null}
                </p>
                <p className="text-ink-muted mt-[2px] truncate text-[13px]">
                  {item.codeMasked} · {formatDateIso(item.createdAt)}
                </p>
              </div>

              <CouponStatusBadge status={item.status} size="sm" />
              <ChevronDownIcon
                className={cn(
                  'text-ink-muted size-4 shrink-0 transition-transform',
                  isOpen && 'rotate-180',
                )}
              />
            </button>

            {isOpen ? (
              <div id={detailId} className="border-field-line bg-page-sub border-t px-4 py-4">
                <CouponHistoryDetail item={item} />
              </div>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
