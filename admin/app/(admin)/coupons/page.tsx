import { CouponFilters } from '@/components/coupons/CouponFilters'
import { CouponFormDialog } from '@/components/coupons/CouponFormDialog'
import { CouponTable } from '@/components/coupons/CouponTable'
import { FormBanner, PageHeader } from '@/components/ui'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import { COUPON_SORT_KEYS, getCoupons } from '@/lib/data/coupons'
import { parsePage, parseSort } from '@/lib/utils/table-query'
import { parseCouponFilters } from '@/lib/validation/coupons'

import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: '쿠폰',
}

/* 상태(활성 · 기간 만료)는 시각에 따라 바뀌는 파생값이다. 캐시된 목록을 보여 주면
   이미 끝난 이벤트가 계속 '활성'으로 남아 운영자가 그대로 안내한다. */
export const dynamic = 'force-dynamic'

export default async function CouponsPage(props: PageProps<'/coupons'>) {
  const { permissions } = await requirePermission('coupons', 'read')
  const canWrite = hasPermission(permissions, 'coupons', 'write')
  const params = await props.searchParams
  const filters = parseCouponFilters(params)
  const sort = parseSort(params.sort, COUPON_SORT_KEYS, { key: 'created_at', direction: 'desc' })
  const page = parsePage(params.page)

  const { rows, count, hasError } = await getCoupons(filters, {
    page,
    sortKey: sort.key,
    ascending: sort.direction === 'asc',
  })

  return (
    <>
      <PageHeader
        title="쿠폰"
        description="코드를 만들어 배포하고, 사용자가 마이페이지에서 등록한 내역을 처리합니다. 실제 지급은 게임 안에서 이뤄집니다."
        action={canWrite ? <CouponFormDialog triggerLabel="쿠폰 만들기" /> : undefined}
      />

      <CouponFilters params={params} filters={filters} />

      {hasError && (
        <div className="mb-3">
          <FormBanner message={LIST_LOAD_ERROR} />
        </div>
      )}

      <CouponTable rows={rows} params={params} sort={sort} page={page} count={count} />
    </>
  )
}
