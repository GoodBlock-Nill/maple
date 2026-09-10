import 'server-only'

import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange } from '@/lib/utils/table-query'
import {
  COUPON_REDEMPTION_STATUSES,
  type CouponRedemptionStatus,
  type RedemptionFilters,
} from '@/lib/validation/coupon-redemptions'

/**
 * 쿠폰 등록 내역 조회.
 *
 * `coupons.ts` 에서 떼어 낸 것은 파일 300줄 상한 때문이다. 화면은 지금까지처럼
 * `@/lib/data/coupons` 한곳에서 가져다 쓴다(그쪽이 다시 내보낸다).
 *
 * 세션 클라이언트로 읽는다 — `coupon_redemptions_select_admin` 이 관리자에게만 전체
 * 조회를 열어 두므로, 권한이 사라지면 화면도 함께 비는 것이 정상이다.
 */

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const REDEMPTION_COLUMNS =
  'id, coupon_id, user_id, nickname_snapshot, msw_uid, msw_profile_code, status, admin_note, processed_by, processed_at, created_at, member:profiles!coupon_redemptions_user_id_fkey(nickname), processor:profiles!coupon_redemptions_processed_by_fkey(nickname)'

/** 전체 + 상태별 건수. `used` 는 한도를 소모한 수(= 전체 − 거절)다. */
export type CouponRedemptionCounts = Record<CouponRedemptionStatus | 'all' | 'used', number>

export type RedemptionListItem = {
  id: string
  userId: string | null
  nickname: string
  mswUid: string
  mswProfileCode: string
  status: CouponRedemptionStatus
  adminNote: string | null
  processorNickname: string | null
  processedAt: string | null
  createdAt: string
}

export type RedemptionListResult = {
  rows: readonly RedemptionListItem[]
  count: number
  /** 조회가 깨졌는지. `true` 면 `rows` 가 비어도 "데이터 없음"이 아니다(빈 표 오독 방지). */
  hasError: boolean
}

/* 상태별 건수. `head: true` 라 행을 가져오지 않고(응답 0바이트), 넷은 서로 의존하지
   않으므로 한 번에 던진다. 집계가 깨지면 0 으로 둔다 — 이 숫자는 탭 라벨이고,
   목록 자체는 `hasError` 로 따로 알린다. */
export async function getCouponRedemptionCounts(couponId: string): Promise<CouponRedemptionCounts> {
  const supabase = await createClient()

  const [all, ...perStatus] = await Promise.all([
    supabase
      .from('coupon_redemptions')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', couponId),
    ...COUPON_REDEMPTION_STATUSES.map((status) =>
      supabase
        .from('coupon_redemptions')
        .select('id', { count: 'exact', head: true })
        .eq('coupon_id', couponId)
        .eq('status', status),
    ),
  ])

  const counts = Object.fromEntries(
    COUPON_REDEMPTION_STATUSES.map((status, index) => [status, perStatus[index]?.count ?? 0]),
  ) as Record<CouponRedemptionStatus, number>

  return { ...counts, all: all.count ?? 0, used: (all.count ?? 0) - counts.rejected }
}

export async function getCouponRedemptions(
  couponId: string,
  filters: RedemptionFilters,
  options: { page: number },
): Promise<RedemptionListResult> {
  const supabase = await createClient()
  const [from, to] = pageRange(options.page, DEFAULT_PAGE_SIZE)

  let query = supabase
    .from('coupon_redemptions')
    .select(REDEMPTION_COLUMNS, { count: 'exact' })
    .eq('coupon_id', couponId)

  if (filters.status !== null) {
    query = query.eq('status', filters.status)
  }

  const { data, count, error } = await query
    .order('created_at', { ascending: false })
    // 같은 시각의 행이 페이지마다 흔들리지 않도록 안정 정렬용 2차 키를 둔다.
    .order('id', { ascending: true })
    .range(from, to)

  if (error !== null) {
    console.error('[coupons] 등록 내역 조회 실패', error.message)

    return { rows: [], count: 0, hasError: true }
  }

  const rows: readonly RedemptionListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    userId: row.user_id,
    /* 스냅샷이 먼저다 — 파기된 계정에는 프로필 닉네임이 익명값으로 남아 있어,
       그것을 앞세우면 "누가 신청했는지"가 화면에서 사라진다. */
    nickname: row.nickname_snapshot ?? row.member?.nickname ?? '(알 수 없음)',
    mswUid: row.msw_uid,
    mswProfileCode: row.msw_profile_code,
    status: row.status as CouponRedemptionStatus,
    adminNote: row.admin_note,
    processorNickname: row.processor?.nickname ?? null,
    processedAt: row.processed_at,
    createdAt: row.created_at,
  }))

  return { rows, count: count ?? 0, hasError: false }
}

/** 회원 상세의 '쿠폰 등록 n건'. 실패는 null 로 둬 호출부가 칸을 감춘다. */
export async function countRedemptionsByMember(userId: string): Promise<number | null> {
  const supabase = await createClient()
  const { count, error } = await supabase
    .from('coupon_redemptions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (error !== null) {
    console.error('[coupons] 회원별 등록 건수 집계 실패', error.message)

    return null
  }

  return count ?? 0
}
