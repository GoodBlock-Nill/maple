import { z } from 'zod'

import { firstValue, type QueryParams } from '@/lib/utils/table-query'

/**
 * 쿠폰 등록 이력의 상태 계약.
 *
 * 지급은 **게임 안에서 사람이 한다.** 관리자 콘솔이 하는 일은 "누가 무엇을 신청했는지"
 * 를 모아 두고, 게임팀이 처리한 결과를 되받아 적는 것뿐이다. 그래서 상태는 셋이다.
 *
 *   pending   접수됨 — 아직 게임팀에 넘기지 않았거나 처리 중
 *   delivered 지급 완료
 *   rejected  거절(중복 신청 · 잘못된 UID · 이벤트 대상 아님 …)
 *
 * **되돌리는 전이는 없다.** 지급을 취소하려면 게임 안에서 회수해야 하는데 콘솔에는
 * 그럴 수단이 없다. 상태만 pending 으로 되돌리면 "미지급"으로 보이는 지급 건이 생겨
 * 두 번 지급된다. 잘못 눌렀다면 메모에 사유를 적는 것이 정확한 기록이다.
 */

export const COUPON_REDEMPTION_STATUSES = ['pending', 'delivered', 'rejected'] as const

export type CouponRedemptionStatus = (typeof COUPON_REDEMPTION_STATUSES)[number]

export const COUPON_REDEMPTION_STATUS_LABELS: Record<CouponRedemptionStatus, string> = {
  pending: '처리 대기',
  delivered: '지급 완료',
  rejected: '거절',
}

/** 허용 전이. 끝난 상태(delivered · rejected)에서 나가는 길은 없다. */
export const COUPON_REDEMPTION_TRANSITIONS: Record<
  CouponRedemptionStatus,
  readonly CouponRedemptionStatus[]
> = {
  pending: ['delivered', 'rejected'],
  delivered: [],
  rejected: [],
}

export function isCouponRedemptionStatus(
  value: string | null | undefined,
): value is CouponRedemptionStatus {
  return (
    typeof value === 'string' && (COUPON_REDEMPTION_STATUSES as readonly string[]).includes(value)
  )
}

/** 같은 상태로의 "전이"는 전이가 아니다 — 호출부가 무변경을 따로 다루게 한다. */
export function canTransitionRedemptionStatus(
  from: CouponRedemptionStatus,
  to: CouponRedemptionStatus,
): boolean {
  return COUPON_REDEMPTION_TRANSITIONS[from].includes(to)
}

/** 운영자가 고를 수 있는 다음 상태. 화면의 버튼과 액션이 같은 표를 본다. */
export const COUPON_REDEMPTION_ACTIONABLE = ['delivered', 'rejected'] as const

export const COUPON_ADMIN_NOTE_MAX_LENGTH = 300

export const couponRedemptionStatusSchema = z.object({
  redemptionId: z.uuid('등록 내역을 찾을 수 없습니다.'),
  status: z.enum(COUPON_REDEMPTION_ACTIONABLE),
  note: z
    .string()
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .pipe(
      z
        .string()
        .max(
          COUPON_ADMIN_NOTE_MAX_LENGTH,
          `메모는 ${COUPON_ADMIN_NOTE_MAX_LENGTH}자를 넘을 수 없습니다.`,
        ),
    )
    .transform((value) => (value === '' ? null : value)),
})

export type CouponRedemptionStatusInput = z.infer<typeof couponRedemptionStatusSchema>

/* -------------------------------------------------------------------------
 * 상세 화면의 상태 탭
 * ---------------------------------------------------------------------- */

export type RedemptionFilters = {
  /** null 이면 전체. */
  status: CouponRedemptionStatus | null
}

export function parseRedemptionFilters(params: QueryParams): RedemptionFilters {
  const status = firstValue(params.rstatus)

  return { status: isCouponRedemptionStatus(status) ? status : null }
}

export type RedemptionTab = {
  value: CouponRedemptionStatus | 'all'
  label: string
}

/** 기본 탭은 '전체'다 — 상세로 들어온 운영자는 대개 이 쿠폰의 전모를 보러 온다. */
export const REDEMPTION_TABS: readonly RedemptionTab[] = [
  { value: 'all', label: '전체' },
  { value: 'pending', label: COUPON_REDEMPTION_STATUS_LABELS.pending },
  { value: 'delivered', label: COUPON_REDEMPTION_STATUS_LABELS.delivered },
  { value: 'rejected', label: COUPON_REDEMPTION_STATUS_LABELS.rejected },
]
