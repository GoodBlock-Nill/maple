'use server'

import { refresh } from 'next/cache'
import { redirect } from 'next/navigation'

import { readField, toFieldErrors } from '@/lib/actions/form-state'
import { createClient } from '@/lib/supabase/server'
import {
  COUPON_ERROR_FIELD,
  COUPON_GENERIC_FAILURE_MESSAGE,
  COUPON_SUCCESS_MESSAGE,
  couponErrorMessage,
  parseRedeemCouponResult,
} from '@/lib/utils/coupon-result'
import { redeemCouponSchema } from '@/lib/validation/account'
import { ACCOUNT_PATH } from '@/lib/validation/auth'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 쿠폰 등록 — `public.redeem_coupon()` 이 유일한 입구다.
 *
 * 쿠폰 테이블에는 일반 사용자 select 정책이 없고(코드 열거 차단),
 * `coupon_redemptions` 에는 insert 권한이 없다. 그래서 이 액션은 조회·삽입을
 * 직접 하지 않고 SECURITY DEFINER 함수 하나만 부른다 — 한도 판정과 삽입 사이의
 * 경합도 함수 안의 `for update` 가 막는다.
 *
 * 함수는 예외를 던지지 않는다. 성공·실패 모두 jsonb 로 오므로, 여기서는 `code` 를
 * 화면 문구로 옮기기만 한다(매핑은 `lib/utils/coupon-result.ts`).
 */

const LOGIN_PATH = '/login'
const COUPON_PATH = `${ACCOUNT_PATH}/coupon`

export type RedeemCouponState = FormState & {
  /** 성공했을 때만 채워진다. 안내 문구 아래에 쿠폰 이름을 덧붙이는 데 쓴다. */
  couponName?: string
  /** 성공 렌더 후 폼을 비우기 위한 표식(같은 값이 두 번 오지 않도록 시각을 담는다). */
  successAt?: number
  /** 방금 만들어진 등록 이력 id. 아래 "쿠폰 등록 내역" 카드가 그 줄을 짚는 데 쓴다. */
  redemptionId?: string
}

export async function redeemCouponAction(
  _prevState: RedeemCouponState,
  formData: FormData,
): Promise<RedeemCouponState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user === null) {
    redirect(`${LOGIN_PATH}?next=${encodeURIComponent(COUPON_PATH)}`)
  }

  const parsed = redeemCouponSchema.safeParse({
    code: readField(formData, 'code'),
    mswUid: readField(formData, 'mswUid'),
    mswProfileCode: readField(formData, 'mswProfileCode'),
  })

  if (!parsed.success) {
    return { fieldErrors: toFieldErrors(parsed.error) }
  }

  const { data, error } = await supabase.rpc('redeem_coupon', {
    p_code: parsed.data.code,
    p_msw_uid: parsed.data.mswUid,
    p_msw_profile_code: parsed.data.mswProfileCode,
  })

  if (error !== null) {
    return { formError: COUPON_GENERIC_FAILURE_MESSAGE }
  }

  const result = parseRedeemCouponResult(data)

  if (!result.ok) {
    const field = COUPON_ERROR_FIELD[result.code]
    const message = couponErrorMessage(result.code)

    return field === undefined ? { formError: message } : { fieldErrors: { [field]: message } }
  }

  /* 등록 이력 목록과 헤더(프로필의 UID 가 이때 채워질 수 있다)를 함께 갱신한다. */
  refresh()

  return {
    message: COUPON_SUCCESS_MESSAGE,
    couponName: result.couponName,
    successAt: Date.now(),
    /* RPC 가 id 를 돌려주지 못한 경우(있을 수 없지만)에도 등록은 성공이다.
       강조만 생략한다 — 표식이 없다고 성공 안내까지 접을 이유가 없다. */
    redemptionId: result.redemptionId ?? undefined,
  }
}
