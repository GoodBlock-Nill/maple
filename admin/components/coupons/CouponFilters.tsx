import Link from 'next/link'

import { Button, Input } from '@/components/ui'
import { SEARCH_MAX_LENGTH } from '@/lib/constants/field-limits'
import { cn } from '@/lib/utils/cn'
import { buildHref, type QueryParams } from '@/lib/utils/table-query'
import {
  COUPON_STATUSES,
  COUPON_STATUS_LABELS,
  type CouponFilters as Filters,
} from '@/lib/validation/coupons'

const LIST_PATH = '/coupons'

/**
 * 쿠폰 목록 필터 — 상태 탭 + 검색 폼.
 *
 * 상태 탭은 `<Link>`, 검색은 **GET 폼**이다. 둘 다 자바스크립트 없이 동작하고 결과가
 * 그대로 주소에 남아 새로고침·뒤로가기·링크 공유가 같은 화면을 낸다(문의 목록과 같은 규약).
 * 탭에 건수를 붙이지 않는 이유: 쿠폰은 많아야 수십 개라 숫자가 판단을 돕지 않고,
 * 상태별 집계 네 번이 목록 조회보다 비싸진다.
 */
export function CouponFilters({ params, filters }: { params: QueryParams; filters: Filters }) {
  const tabs = [
    { value: null, label: '전체' },
    ...COUPON_STATUSES.map((status) => ({
      value: status,
      label: COUPON_STATUS_LABELS[status],
    })),
  ]

  return (
    <div className="mb-4 flex flex-col gap-3">
      <nav aria-label="상태" className="flex flex-wrap gap-1.5">
        {tabs.map((tab) => {
          const isActive = tab.value === filters.status

          return (
            <Link
              key={tab.value ?? 'all'}
              href={buildHref(LIST_PATH, params, { status: tab.value, page: null })}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'rounded-pill inline-flex items-center border px-3 py-1.5 text-[13px] font-semibold',
                'focus-visible:outline-focus focus-visible:outline-2 focus-visible:outline-offset-2',
                isActive
                  ? 'border-accent bg-accent text-white'
                  : 'border-line bg-surface text-muted hover:text-ink hover:bg-page',
              )}
            >
              {tab.label}
            </Link>
          )
        })}
      </nav>

      <form
        action={LIST_PATH}
        method="get"
        className="border-line bg-surface rounded-card flex flex-wrap items-end gap-2 border px-4 py-3"
      >
        {filters.status !== null && <input type="hidden" name="status" value={filters.status} />}

        <Input
          label="검색"
          name="q"
          type="search"
          defaultValue={filters.search ?? ''}
          maxLength={SEARCH_MAX_LENGTH}
          countPlacement="label"
          placeholder="쿠폰 코드 · 이름"
          wrapperClassName="min-w-[240px] flex-1"
        />

        <div className="flex gap-2">
          <Button type="submit">검색</Button>
          <Button
            href={filters.status === null ? LIST_PATH : `${LIST_PATH}?status=${filters.status}`}
            variant="secondary"
          >
            초기화
          </Button>
        </div>
      </form>
    </div>
  )
}
