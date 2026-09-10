import { CouponPeriod } from '@/components/coupons/CouponPeriod'
import { CouponStatusBadge } from '@/components/coupons/CouponStatusBadge'
import { MemberField } from '@/components/members/MemberField'
import { Card, CardBody, CardHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/utils/format-date'
import { COUPON_STATUS_LABELS, isCouponRedeemable } from '@/lib/validation/coupons'

import type { CouponDetail } from '@/lib/data/coupons'
import type { ReactNode } from 'react'

/**
 * 쿠폰 요약 카드.
 *
 * 라벨/값 한 칸은 회원 상세와 같은 `MemberField` 를 쓴다. 두 화면이 나란히 쓰이므로
 * 각자 비슷한 마크업을 들고 있으면 여백·글자 크기가 조금씩 어긋나 보인다.
 *
 * 지금 등록되지 않는 쿠폰에는 **이유를 한 줄로 적는다.** 상태 뱃지만으로는 "왜 안
 * 되는지"를 운영자가 사용자에게 설명할 수 없다.
 */
export function CouponSummary({ coupon, actions }: { coupon: CouponDetail; actions: ReactNode }) {
  const remaining =
    coupon.maxRedemptions === null ? null : Math.max(0, coupon.maxRedemptions - coupon.counts.used)

  return (
    <Card className="mb-5">
      <CardHeader
        title={<span className="font-mono">{coupon.code}</span>}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span data-testid="coupon-status">
              <CouponStatusBadge status={coupon.status} />
            </span>
            <span>{coupon.name}</span>
          </span>
        }
        action={actions}
      />

      {!isCouponRedeemable(coupon.status) && (
        <p className="border-line bg-page text-muted border-b px-5 py-3 text-[13px]">
          지금은 등록되지 않습니다({COUPON_STATUS_LABELS[coupon.status]}). 사용자에게는
          &lsquo;사용할 수 없는 코드&rsquo;로 보입니다.
        </p>
      )}

      <CardBody className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-4">
        <MemberField
          label="노출 기간"
          value={<CouponPeriod startsAt={coupon.startsAt} endsAt={coupon.endsAt} />}
        />
        <MemberField
          label="전체 한도"
          value={
            coupon.maxRedemptions === null
              ? '무제한'
              : `${coupon.counts.used.toLocaleString('ko-KR')} / ${coupon.maxRedemptions.toLocaleString('ko-KR')} (남은 ${remaining?.toLocaleString('ko-KR')})`
          }
          tone={remaining === 0 ? 'danger' : 'default'}
        />
        <MemberField label="1인 등록 횟수" value={`${coupon.perUserLimit}회`} />
        <MemberField
          label="처리 대기"
          value={`${coupon.counts.pending.toLocaleString('ko-KR')}건`}
          tone={coupon.counts.pending > 0 ? 'danger' : 'default'}
        />
        <MemberField label="지급 내용" value={coupon.rewardNote ?? '-'} className="sm:col-span-2" />
        <MemberField label="생성일" value={formatDateTime(coupon.createdAt)} />
        <MemberField label="최근 수정" value={formatDateTime(coupon.updatedAt)} />
        {coupon.description !== null && (
          <MemberField
            label="설명(운영 메모)"
            value={coupon.description}
            className="sm:col-span-2 lg:col-span-4"
          />
        )}
      </CardBody>
    </Card>
  )
}
