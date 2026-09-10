'use client'

import { CouponCodeField } from '@/components/coupons/CouponCodeField'
import { Input, Textarea } from '@/components/ui'
import {
  COUPON_DESCRIPTION_MAX_LENGTH,
  COUPON_NAME_MAX_LENGTH,
  COUPON_PER_USER_LIMIT_MAX,
  COUPON_REWARD_NOTE_MAX_LENGTH,
  isoToKstLocal,
} from '@/lib/validation/coupons'

import type { CouponDetail } from '@/lib/data/coupons'

/**
 * 쿠폰 등록·수정 폼의 입력들.
 *
 * 다이얼로그에서 떼어 낸 것은 컴포넌트 200줄 상한 때문이다. 상태를 갖는 것은 코드
 * 칸뿐이라(자동 생성) 나머지는 비제어로 두고 브라우저에 맡긴다.
 *
 * 시각은 `datetime-local` 이다. 이 컨트롤에는 타임존이 없으므로 값은 **한국시간으로
 * 읽고 쓴다**(`kstLocalToIso` · `isoToKstLocal`). 힌트에도 그렇게 적어 둔다 — 적지
 * 않으면 운영자가 UTC 로 넣는 사고가 반드시 한 번은 난다.
 */
export function CouponFormFields({
  coupon,
  fieldErrors,
  isPending,
}: {
  coupon?: CouponDetail
  fieldErrors?: Record<string, string>
  isPending: boolean
}) {
  return (
    <>
      <CouponCodeField
        defaultValue={coupon?.code ?? ''}
        error={fieldErrors?.code}
        disabled={isPending}
      />

      <Input
        label="쿠폰 이름"
        name="name"
        required
        maxLength={COUPON_NAME_MAX_LENGTH}
        defaultValue={coupon?.name ?? ''}
        hint="운영 목록에서 이 쿠폰을 구분하는 이름입니다. 사용자에게는 등록 성공 안내에 표시됩니다."
        error={fieldErrors?.name}
        disabled={isPending}
      />

      <Input
        label="지급 내용"
        name="rewardNote"
        maxLength={COUPON_REWARD_NOTE_MAX_LENGTH}
        defaultValue={coupon?.rewardNote ?? ''}
        hint="예: 성장의 비약 10개. 등록에 성공한 사용자에게 그대로 보이고, 게임팀에 넘기는 지급 지시가 됩니다."
        error={fieldErrors?.rewardNote}
        disabled={isPending}
      />

      <Textarea
        label="설명"
        name="description"
        rows={3}
        maxLength={COUPON_DESCRIPTION_MAX_LENGTH}
        defaultValue={coupon?.description ?? ''}
        hint="운영 메모입니다. 사용자 화면에는 나오지 않습니다."
        error={fieldErrors?.description}
        disabled={isPending}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="시작 시각"
          name="startsAt"
          type="datetime-local"
          defaultValue={isoToKstLocal(coupon?.startsAt)}
          hint="비우면 즉시 시작합니다. 한국시간 기준입니다."
          error={fieldErrors?.startsAt}
          disabled={isPending}
        />
        <Input
          label="종료 시각"
          name="endsAt"
          type="datetime-local"
          defaultValue={isoToKstLocal(coupon?.endsAt)}
          hint="비우면 기한이 없습니다. 적은 시각 정각부터 등록이 막힙니다."
          error={fieldErrors?.endsAt}
          disabled={isPending}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Input
          label="전체 등록 한도"
          name="maxRedemptions"
          type="number"
          min={1}
          inputMode="numeric"
          defaultValue={
            coupon?.maxRedemptions === undefined || coupon.maxRedemptions === null
              ? ''
              : String(coupon.maxRedemptions)
          }
          hint="비우면 무제한입니다. 거절한 등록은 한도를 소모하지 않습니다."
          error={fieldErrors?.maxRedemptions}
          disabled={isPending}
        />
        <Input
          label="1인 등록 횟수"
          name="perUserLimit"
          type="number"
          min={1}
          max={COUPON_PER_USER_LIMIT_MAX}
          inputMode="numeric"
          required
          defaultValue={String(coupon?.perUserLimit ?? 1)}
          hint={`한 회원이 이 쿠폰을 등록할 수 있는 횟수입니다(최대 ${COUPON_PER_USER_LIMIT_MAX}).`}
          error={fieldErrors?.perUserLimit}
          disabled={isPending}
        />
      </div>

      <label className="text-ink flex items-center gap-2 text-[13px]">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={coupon?.isActive ?? true}
          disabled={isPending}
          className="accent-accent size-4"
        />
        지금 활성화 (끄면 사용자에게는 없는 코드처럼 보입니다)
      </label>
    </>
  )
}
