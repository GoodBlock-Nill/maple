import { notFound } from 'next/navigation'

import { CopyUidsButton } from '@/components/coupons/CopyUidsButton'
import { CouponActiveButton } from '@/components/coupons/CouponActiveButton'
import { CouponDeleteButton } from '@/components/coupons/CouponDeleteButton'
import { CouponFormDialog } from '@/components/coupons/CouponFormDialog'
import { CouponSummary } from '@/components/coupons/CouponSummary'
import { RedemptionTable } from '@/components/coupons/RedemptionTable'
import { RedemptionTabs } from '@/components/coupons/RedemptionTabs'
import { Button, Card, CardHeader, FormBanner, PageHeader } from '@/components/ui'
import { hasPermission } from '@/lib/auth/permissions'
import { requirePermission } from '@/lib/auth/require-admin'
import { LIST_LOAD_ERROR } from '@/lib/constants/messages'
import { getCoupon, getCouponRedemptions } from '@/lib/data/coupons'
import { parsePage } from '@/lib/utils/table-query'
import { parseRedemptionFilters } from '@/lib/validation/coupon-redemptions'

import type { Metadata } from 'next'

/** 등록 내역에 회원 식별자(MSW UID)가 들어가므로 색인하지 않는다. */
export const metadata: Metadata = {
  title: '쿠폰 상세',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

export default async function CouponDetailPage(props: PageProps<'/coupons/[id]'>) {
  const [{ id }, params] = await Promise.all([props.params, props.searchParams])
  const [admin, coupon] = await Promise.all([requirePermission('coupons', 'read'), getCoupon(id)])
  const canWrite = hasPermission(admin.permissions, 'coupons', 'write')

  if (coupon === null) {
    notFound()
  }

  const filters = parseRedemptionFilters(params)
  const page = parsePage(params.page)
  const redemptions = await getCouponRedemptions(coupon.id, filters, { page })

  return (
    <>
      <PageHeader
        title={coupon.name}
        description={
          canWrite
            ? '등록 내역을 확인하고 지급 여부를 기록합니다.'
            : '등록 내역을 확인합니다(읽기 전용).'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            {canWrite && (
              <CouponFormDialog coupon={coupon} triggerLabel="수정" triggerVariant="secondary" />
            )}
            {canWrite && (
              <CouponActiveButton
                couponId={coupon.id}
                code={coupon.code}
                isActive={coupon.isActive}
              />
            )}
            {/* 삭제는 이력이 한 건도 없을 때만 노출한다 — 액션과 FK 가 다시 막는다. */}
            {canWrite && coupon.counts.all === 0 && (
              <CouponDeleteButton couponId={coupon.id} code={coupon.code} />
            )}
            <Button href="/coupons" variant="ghost" size="sm">
              목록
            </Button>
          </div>
        }
      />

      <CouponSummary coupon={coupon} actions={null} />

      <Card>
        <CardHeader
          title="등록 내역"
          description="게임팀에 넘길 UID 는 아래 '복사'로 한 줄에 하나씩 받을 수 있습니다(지금 보이는 목록 기준)."
          action={<CopyUidsButton uids={redemptions.rows.map((row) => row.mswUid)} />}
        />

        <div className="border-line flex flex-col gap-3 border-b px-5 py-4">
          <RedemptionTabs
            couponId={coupon.id}
            params={params}
            active={filters.status}
            counts={coupon.counts}
          />
          {redemptions.hasError && <FormBanner message={LIST_LOAD_ERROR} />}
        </div>

        <RedemptionTable
          rows={redemptions.rows}
          couponId={coupon.id}
          params={params}
          page={page}
          count={redemptions.count}
          canWrite={canWrite}
        />
      </Card>
    </>
  )
}
