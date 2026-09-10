import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { toCouponStatus } from '@/lib/utils/coupon-result'

import type { CouponRedemptionStatus } from '@/lib/utils/coupon-result'

/**
 * 내가 등록한 쿠폰 이력 (`coupon_redemptions`).
 *
 * 최종 방어선은 RLS(`coupon_redemptions_select_own`)지만 질의에도 `user_id` 조건을
 * 건다 — 관리자 세션에는 전체 조회가 열려 있어서(같은 테이블의 admin 정책) 조건을
 * 빼면 이 화면이 남의 등록 이력을 그리게 된다.
 *
 * 쿠폰 이름·코드는 **읽히지 않을 수 있다.** `coupons` 에는 일반 사용자 select
 * 정책이 없어서(코드 열거 차단, 마이그레이션 20260910000100 §3) 임베드가 `null`
 * 로 온다. 정책이 열리는 날 그대로 채워지도록 질의에는 남겨 두고, 화면은 값이
 * 없을 때를 기본값으로 삼는다.
 */

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const REDEMPTION_COLUMNS = 'id, status, created_at, coupons(name, code)'

export type CouponRedemptionSummary = {
  id: string
  /** 읽히지 않으면 null. 화면은 "-" 로 그린다. */
  couponName: string | null
  couponCode: string | null
  status: CouponRedemptionStatus
  createdAt: string
}

/** 카드 안에 곁들이는 목록이라 최근 것만 보여 준다. */
export const COUPON_HISTORY_LIMIT = 10

type RedemptionRow = {
  id: string
  status: string
  created_at: string
  coupons: { name: string; code: string } | null
}

function toSummary(row: RedemptionRow): CouponRedemptionSummary {
  return {
    id: row.id,
    couponName: row.coupons?.name ?? null,
    couponCode: row.coupons?.code ?? null,
    status: toCouponStatus(row.status),
    createdAt: row.created_at,
  }
}

export async function getMyCouponRedemptions(
  userId: string,
): Promise<readonly CouponRedemptionSummary[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coupon_redemptions')
    .select(REDEMPTION_COLUMNS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(COUPON_HISTORY_LIMIT)

  /* 목록은 곁들임이다. 못 읽었다고 쿠폰 등록 폼까지 막을 이유가 없다. */
  if (error !== null || data === null) {
    return []
  }

  return data.map((row) => toSummary(row as RedemptionRow))
}
