'use client'

import { CouponHistoryDetail } from '@/components/account/CouponHistoryDetail'
import { CouponStatusBadge } from '@/components/account/CouponStatusBadge'
import { ChevronDownIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils/cn'
import { formatDateIso } from '@/lib/utils/format-date'

import type { CouponRedemption } from '@/lib/constants/coupons'

/**
 * "쿠폰 등록 내역" 표(데스크톱) — 문의내역 표(시안 §6)와 같은 표면값을 쓴다.
 * 머리 행 h47(선 포함) bg #ededed · 본문 행 h53 · border-b #d5d9df · 폭 합계 850.
 *
 * 줄을 누르면 그 아래로 속내용이 열린다. 상세 페이지를 따로 두지 않는 이유는
 * 보여 줄 것이 네 줄뿐이고, 목록에서 한 건씩 대조하는 화면이기 때문이다 —
 * 페이지를 오가면 "어디까지 봤는지"를 매번 잃는다.
 *
 * 접힘 상태는 `<tbody>` 하나가 한 건을 감싸는 방식으로 표현한다. 본문 행과 속내용
 * 행이 같은 그룹에 있어야 스크린 리더가 둘을 이어서 읽고, 마지막 그룹의 아래 선만
 * 지워 표 테두리와 겹치지 않게 할 수 있다.
 */

/** 시안(문의내역) 실측 폭 합계 850 에 맞춘 다섯 열. */
const COLUMNS = [
  { key: 'no', label: '번호', width: 88 },
  { key: 'coupon', label: '쿠폰', width: 300 },
  { key: 'code', label: '코드', width: 190 },
  { key: 'date', label: '등록일', width: 151 },
  { key: 'status', label: '상태', width: 121 },
] as const

const CELL_CLASS = 'text-ink text-ui px-2 text-center font-medium'

type CouponHistoryTableProps = {
  items: readonly CouponRedemption[]
  openId: string | null
  onToggle: (id: string) => void
  /** 방금 등록해 잠깐 강조할 줄. */
  highlightId: string | null
}

export function CouponHistoryTable({
  items,
  openId,
  onToggle,
  highlightId,
}: CouponHistoryTableProps) {
  return (
    <div className="border-line-soft shadow-top3 hidden overflow-hidden rounded-[20px] border lg:block">
      <table className="w-full table-fixed border-collapse">
        <colgroup>
          {COLUMNS.map((column) => (
            <col key={column.key} style={{ width: column.width }} />
          ))}
        </colgroup>

        <thead>
          <tr className="bg-tray border-field-line h-[47px] border-b">
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                scope="col"
                className="text-ui px-2 text-center font-medium text-[#727272]"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>

        {items.map((item, index) => {
          const isOpen = openId === item.id
          const detailId = `coupon-detail-${item.id}`

          return (
            <tbody key={item.id} className="[&:last-child>tr:last-child]:border-b-0">
              <tr
                className={cn(
                  'border-field-line relative h-[53px] border-b transition-colors',
                  highlightId === item.id && 'coupon-row-new',
                  isOpen && 'bg-black/[0.02]',
                )}
              >
                <td className={CELL_CLASS}>{index + 1}</td>
                <td className={CELL_CLASS}>
                  <button
                    type="button"
                    onClick={() => onToggle(item.id)}
                    aria-expanded={isOpen}
                    aria-controls={detailId}
                    className="focus-visible:outline-focus flex w-full items-center justify-center gap-[6px] after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-offset-[-2px]"
                  >
                    <span className="truncate">{item.couponName}</span>
                    {highlightId === item.id ? (
                      <span className="sr-only">방금 등록한 쿠폰입니다.</span>
                    ) : null}
                    <ChevronDownIcon
                      className={cn(
                        'text-ink-muted size-4 shrink-0 transition-transform',
                        isOpen && 'rotate-180',
                      )}
                    />
                  </button>
                </td>
                <td className={cn(CELL_CLASS, 'text-ink-muted tabular-nums')}>{item.codeMasked}</td>
                <td className={CELL_CLASS}>{formatDateIso(item.createdAt)}</td>
                <td className={CELL_CLASS}>
                  <CouponStatusBadge status={item.status} />
                </td>
              </tr>

              {isOpen ? (
                <tr id={detailId} className="border-field-line bg-page-sub border-b">
                  <td colSpan={COLUMNS.length} className="px-6 py-5">
                    <CouponHistoryDetail item={item} />
                  </td>
                </tr>
              ) : null}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
