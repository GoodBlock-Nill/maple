import 'server-only'

import { COUPON_HISTORY_MAX } from '@/lib/constants/coupons'
import { createClient } from '@/lib/supabase/server'
import { toCouponStatus } from '@/lib/utils/coupon-result'

import type { CouponHistory, CouponRedemption } from '@/lib/constants/coupons'

/**
 * 내가 등록한 쿠폰 이력 — `public.my_coupon_redemptions()` RPC 하나로 읽는다.
 *
 * 테이블을 직접 조회하지 않는 이유는 `coupons` 에 일반 사용자 select 정책이 **없기**
 * 때문이다(코드 열거 차단, 마이그레이션 20260910000100 §3). 그래서 임베드로는 쿠폰
 * 이름도 보상 안내도 읽히지 않고, 화면에는 "언제 뭔가를 등록했다"만 남는다. 정책을
 * 여는 대신 내가 등록한 행만 골라 내보내는 SECURITY DEFINER 함수를 두었다
 * (20260910000200) — 코드는 DB 에서 마스킹되어 나온다.
 *
 * 이 목록은 쿠폰 등록 화면의 **한 카드**다. 못 읽었다고 등록 폼까지 막지 않는다.
 * 실패는 예외가 아니라 `failed` 표식으로 돌려주고, 화면은 부드러운 안내 한 줄만 띄운다.
 *
 * 목록의 모양(`CouponRedemption`)과 분량 상수는 `lib/constants/coupons.ts` 가
 * 소유한다 — 이 파일은 `server-only` 라 클라이언트 카드가 가져올 수 없다.
 */

/**
 * RPC 한 행.
 *
 * 생성된 타입(`Functions.my_coupon_redemptions.Returns`)은 `returns table` 의
 * 컬럼을 전부 non-null 로 적는다 — 생성기가 함수 본문의 null 가능성을 모른다.
 * 그대로 믿으면 `reward_note.trim()` 같은 코드가 런타임에 터지므로, 이 파일이
 * 실제 모양을 다시 적고 경계에서 좁힌다.
 */
type RedemptionRow = {
  id: string
  coupon_name: string | null
  reward_note: string | null
  code_masked: string | null
  msw_uid: string | null
  msw_profile_code: string | null
  status: string
  admin_note: string | null
  created_at: string
  processed_at: string | null
}

const EMPTY_PLACEHOLDER = '-'

/** 빈 문자열은 null 과 같이 다룬다 — 화면에서 빈칸으로 남으면 자리만 차지한다. */
function text(value: string | null): string | null {
  const trimmed = (value ?? '').trim()

  return trimmed === '' ? null : trimmed
}

export function toCouponRedemption(row: RedemptionRow): CouponRedemption {
  const status = toCouponStatus(row.status)

  return {
    id: row.id,
    couponName: text(row.coupon_name) ?? '쿠폰',
    rewardNote: text(row.reward_note),
    codeMasked: text(row.code_masked) ?? EMPTY_PLACEHOLDER,
    mswUid: text(row.msw_uid) ?? EMPTY_PLACEHOLDER,
    mswProfileCode: text(row.msw_profile_code) ?? EMPTY_PLACEHOLDER,
    status,
    /* 거절이 아닌 건의 메모는 운영 기록이다. RPC 가 이미 걸러 주지만, 화면으로
       가는 마지막 문에서도 한 번 더 막는다. */
    adminNote: status === 'rejected' ? text(row.admin_note) : null,
    createdAt: row.created_at,
    processedAt: row.processed_at,
  }
}

export async function getMyCouponRedemptions(): Promise<CouponHistory> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('my_coupon_redemptions')

  if (error !== null || data === null) {
    return { items: [], failed: true }
  }

  const rows = data as unknown as RedemptionRow[]

  return { items: rows.slice(0, COUPON_HISTORY_MAX).map(toCouponRedemption), failed: false }
}
