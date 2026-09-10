import 'server-only'

import { getCouponRedemptionCounts } from '@/lib/data/coupon-redemptions'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_PAGE_SIZE, pageRange } from '@/lib/utils/table-query'
import { deriveCouponStatus, type CouponFilters, type CouponStatus } from '@/lib/validation/coupons'

import type { CouponRedemptionCounts } from '@/lib/data/coupon-redemptions'

/**
 * 쿠폰 조회 계층.
 *
 * 전부 **세션 클라이언트**로 읽는다. `coupons_admin_all` 정책이 관리자에게만 조회를
 * 열어 두므로, 권한이 사라지면 화면도 함께 비는 것이 정상이다 — 서비스 롤로 읽으면
 * 그 검증이 통째로 사라진다.
 *
 * 상태(활성 · 시작 전 · 기간 만료 · 비활성)는 컬럼이 아니라 파생값이다. 목록의 상태
 * 필터를 화면에서 거르면 페이지네이션이 어긋나므로(20건을 가져와 3건만 남는다),
 * **질의 조건으로 옮겨** 판정한다. 계산식은 `deriveCouponStatus()` 와 같아야 한다.
 *
 * 등록 내역은 `coupon-redemptions.ts` 가 소유한다. 화면이 한곳에서 가져다 쓰도록
 * 여기서 다시 내보낸다 — 기존 임포트 경로가 그대로 동작한다.
 */

export type {
  CouponRedemptionCounts,
  RedemptionListItem,
  RedemptionListResult,
} from '@/lib/data/coupon-redemptions'
export {
  countRedemptionsByMember,
  getCouponRedemptionCounts,
  getCouponRedemptions,
} from '@/lib/data/coupon-redemptions'

/* prettier-ignore — 한 줄 리터럴이어야 supabase-js 가 select 결과 타입을 추론한다. */
const COUPON_COLUMNS =
  'id, code, name, description, reward_note, starts_at, ends_at, max_redemptions, per_user_limit, is_active, created_at, updated_at'

/* prettier-ignore */
const LIST_COLUMNS = 'id, code, name, starts_at, ends_at, max_redemptions, per_user_limit, is_active, created_at, coupon_redemptions(count)'

export type CouponListItem = {
  id: string
  code: string
  name: string
  startsAt: string | null
  endsAt: string | null
  maxRedemptions: number | null
  perUserLimit: number
  isActive: boolean
  /** 거절을 뺀 등록 건수. 한도(`maxRedemptions`)를 소모한 수와 같은 기준이다. */
  usedCount: number
  status: CouponStatus
  createdAt: string
}

export type CouponListResult = {
  rows: readonly CouponListItem[]
  count: number
  /** 조회가 깨졌는지. `true` 면 `rows` 가 비어도 "데이터 없음"이 아니다(빈 표 오독 방지). */
  hasError: boolean
}

export type CouponDetail = {
  id: string
  code: string
  name: string
  description: string | null
  rewardNote: string | null
  startsAt: string | null
  endsAt: string | null
  maxRedemptions: number | null
  perUserLimit: number
  isActive: boolean
  status: CouponStatus
  createdAt: string
  updatedAt: string
  counts: CouponRedemptionCounts
}

export const COUPON_SORT_KEYS = ['created_at', 'code', 'name', 'ends_at'] as const

/** 빌더 타입을 그대로 받으면 supabase-js 내부 제네릭에 묶인다. 쓰는 메서드만 요구한다. */
type CouponQuery<TSelf> = {
  eq: (column: 'is_active', value: boolean) => TSelf
  gt: (column: 'starts_at', value: string) => TSelf
  lte: (column: 'ends_at', value: string) => TSelf
  or: (filters: string) => TSelf
}

/**
 * 파생 상태를 질의 조건으로 옮긴다.
 *
 * `deriveCouponStatus()` 와 순서·경계가 같아야 한다 — 다르면 목록의 뱃지와 필터가
 * 서로 다른 말을 한다. 경계는 시작 `<=` 포함, 종료 `<` 미만이다(종료 시각 정각은 만료).
 */
function applyStatusFilter<TQuery extends CouponQuery<TQuery>>(
  query: TQuery,
  status: CouponStatus | null,
  now: string,
): TQuery {
  if (status === null) {
    return query
  }

  if (status === 'inactive') {
    return query.eq('is_active', false)
  }

  const active = query.eq('is_active', true)

  if (status === 'scheduled') {
    return active.gt('starts_at', now)
  }

  if (status === 'expired') {
    return active.lte('ends_at', now)
  }

  // active: 기간을 지정하지 않은 쿠폰도 '활성'이다(둘 다 null = 상시).
  return active.or(`starts_at.is.null,starts_at.lte.${now}`).or(`ends_at.is.null,ends_at.gt.${now}`)
}

/** 임베드 집계(`coupon_redemptions(count)`)는 항상 배열 한 건으로 온다. */
function toCount(rows: readonly { count: number }[]): number {
  return rows[0]?.count ?? 0
}

export async function getCoupons(
  filters: CouponFilters,
  options: { page: number; sortKey: string; ascending: boolean },
): Promise<CouponListResult> {
  const supabase = await createClient()
  const [from, to] = pageRange(options.page, DEFAULT_PAGE_SIZE)
  const now = new Date().toISOString()

  let query = supabase
    .from('coupons')
    .select(LIST_COLUMNS, { count: 'exact' })
    /* 임베드 필터라 부모(쿠폰)를 걸러 내지 않는다 — 거절만 있는 쿠폰도 목록에 남고
       집계만 0 이 된다. `!inner` 를 쓰면 등록이 없는 쿠폰이 통째로 사라진다. */
    .neq('coupon_redemptions.status', 'rejected')

  query = applyStatusFilter(query, filters.status, now)

  if (filters.search !== null) {
    // 검색어는 parseCouponFilters 가 이미 or() 문법·LIKE 와일드카드를 걷어냈다.
    query = query.or(`code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`)
  }

  const { data, count, error } = await query
    .order(options.sortKey, { ascending: options.ascending, nullsFirst: false })
    // 같은 시각의 행이 페이지마다 흔들리지 않도록 안정 정렬용 2차 키를 둔다.
    .order('id', { ascending: true })
    .range(from, to)

  if (error !== null) {
    console.error('[coupons] 목록 조회 실패', error.message)

    return { rows: [], count: 0, hasError: true }
  }

  const reference = new Date(now)
  const rows: readonly CouponListItem[] = (data ?? []).map((row) => ({
    id: row.id,
    code: row.code,
    name: row.name,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    maxRedemptions: row.max_redemptions,
    perUserLimit: row.per_user_limit,
    isActive: row.is_active,
    usedCount: toCount(row.coupon_redemptions),
    status: deriveCouponStatus(
      { isActive: row.is_active, startsAt: row.starts_at, endsAt: row.ends_at },
      reference,
    ),
    createdAt: row.created_at,
  }))

  return { rows, count: count ?? 0, hasError: false }
}

export async function getCoupon(id: string): Promise<CouponDetail | null> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('coupons')
    .select(COUPON_COLUMNS)
    .eq('id', id)
    .maybeSingle()

  if (error !== null || data === null) {
    // uuid 가 아닌 id 는 22P02 로 떨어진다. 화면은 404 로 다룬다.
    return null
  }

  return {
    id: data.id,
    code: data.code,
    name: data.name,
    description: data.description,
    rewardNote: data.reward_note,
    startsAt: data.starts_at,
    endsAt: data.ends_at,
    maxRedemptions: data.max_redemptions,
    perUserLimit: data.per_user_limit,
    isActive: data.is_active,
    status: deriveCouponStatus({
      isActive: data.is_active,
      startsAt: data.starts_at,
      endsAt: data.ends_at,
    }),
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    counts: await getCouponRedemptionCounts(data.id),
  }
}
