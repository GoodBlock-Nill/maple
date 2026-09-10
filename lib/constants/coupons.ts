import type { CouponRedemptionStatus } from '@/lib/utils/coupon-result'

/**
 * 쿠폰 등록 내역의 **모양과 분량** — 서버(조회)와 클라이언트(카드)가 함께 쓴다.
 *
 * `lib/data/coupons.ts` 에 두면 안 된다. 그 파일은 `server-only` 이고 `next/headers`
 * 에 닿아서, 클라이언트 컴포넌트가 상수 하나를 가져오는 순간 번들이 통째로 깨진다
 * (타입만 가져오면 지워지지만 값은 지워지지 않는다).
 */

/** 처음 펼쳐 보여 주는 줄 수. 그보다 많으면 "더보기"로 마저 편다. */
export const COUPON_HISTORY_PAGE = 10

/**
 * 한 번에 받아 오는 상한.
 *
 * 페이지네이션을 두지 않는다 — 한 사람의 등록 이력은 쿠폰 개수만큼이고, 여기까지
 * 쌓이는 계정이면 목록이 아니라 문의로 다뤄야 할 일이다. 상한은 화면이 무한정
 * 길어지는 것을 막는 안전판이다.
 */
export const COUPON_HISTORY_MAX = 100

export type CouponRedemption = {
  id: string
  couponName: string
  /** 지급 내용(자유 문구). 쿠폰에 적혀 있지 않으면 null. */
  rewardNote: string | null
  /** DB 가 가린 코드(`****-****-0001`). 원문은 서버 밖으로 나오지 않는다. */
  codeMasked: string
  mswUid: string
  mswProfileCode: string
  status: CouponRedemptionStatus
  /** 거절 사유. RPC 가 거절 건에만 실어 준다. */
  adminNote: string | null
  createdAt: string
  processedAt: string | null
}

export type CouponHistory = {
  items: readonly CouponRedemption[]
  /** 조회 자체가 실패했다. "이력이 없다"와 다른 상태라 따로 구분한다. */
  failed: boolean
}
