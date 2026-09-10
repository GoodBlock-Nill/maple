/**
 * `public.redeem_coupon()` 의 jsonb 결과를 화면 문구로 옮긴다.
 *
 * RPC 는 예외를 던지지 않는다(마이그레이션 20260910000100 §4) — 성공·실패 모두
 * 200 + jsonb 로 오고, 화면이 `code` 로 문구를 고른다. 그래서 이 매핑이 곧
 * 사용자에게 보이는 유일한 설명이며, 순수 함수로 떼어 두어 단위 테스트가 붙는다.
 *
 * "없는 코드"와 "꺼진 코드"가 모두 `invalid_code` 인 것은 DB 쪽 의도다. 여기서
 * 둘을 갈라 안내하면 무작위 대입으로 코드 목록을 만들 수 있다.
 */

export type RedeemCouponSuccess = {
  ok: true
  redemptionId: string | null
  couponName: string
  rewardNote: string | null
}

export type RedeemCouponFailure = { ok: false; code: string }

export type RedeemCouponResult = RedeemCouponSuccess | RedeemCouponFailure

/**
 * 등록 성공 안내.
 *
 * "등록됐다"와 "지급됐다"는 다른 일이다. 지급은 운영팀이 게임 안에서 하고, 그 사이
 * 사용자는 아무 일도 일어나지 않은 화면을 본다 — 그래서 안내는 바로 아래 카드로
 * 시선을 넘긴다(거기에 '대기 중' 줄이 새로 생겨 있다).
 */
export const COUPON_SUCCESS_MESSAGE =
  '쿠폰이 등록되었습니다. 아래 “쿠폰 등록 내역”에서 처리 상태를 확인할 수 있습니다.'

export const COUPON_GENERIC_FAILURE_MESSAGE =
  '쿠폰을 등록하지 못했습니다. 잠시 후 다시 시도해 주세요.'

/** 실패 코드 → 한국어 문구. 목록은 RPC 주석의 코드 집합과 1:1 이다. */
export const COUPON_ERROR_MESSAGE: Record<string, string> = {
  invalid_code: '존재하지 않거나 사용할 수 없는 쿠폰 코드입니다.',
  not_started: '아직 사용 기간이 시작되지 않은 쿠폰입니다.',
  expired: '사용 기간이 지난 쿠폰입니다.',
  limit_reached: '쿠폰 수량이 모두 소진되었습니다.',
  already_redeemed: '이미 등록한 쿠폰입니다.',
  msw_uid_taken: '이미 다른 계정에 연결된 월드 계정 UID입니다. 고객지원에 문의해 주세요.',
  msw_profile_code_taken: '이미 다른 계정에 연결된 프로필 코드입니다.',
  invalid_msw_uid: 'UID는 숫자 10~20자로 입력해 주세요. (예: 20123000000000000)',
  invalid_msw_profile_code:
    '프로필 코드는 "#" 뒤에 영문 소문자·숫자 4~10자로 입력해 주세요. (예: #abcd1)',
  unauthorized: '로그인 후 이용할 수 있습니다.',
  withdrawn: '탈퇴 대기 중인 계정은 쿠폰을 등록할 수 없습니다.',
  suspended: '이용이 제한된 계정은 쿠폰을 등록할 수 없습니다.',
}

/** 실패 코드가 가리키는 입력칸. 없으면 폼 상단에 알린다. */
export const COUPON_ERROR_FIELD: Record<string, 'code' | 'mswUid' | 'mswProfileCode'> = {
  invalid_code: 'code',
  not_started: 'code',
  expired: 'code',
  limit_reached: 'code',
  already_redeemed: 'code',
  invalid_msw_uid: 'mswUid',
  msw_uid_taken: 'mswUid',
  invalid_msw_profile_code: 'mswProfileCode',
  msw_profile_code_taken: 'mswProfileCode',
}

export function couponErrorMessage(code: string): string {
  return COUPON_ERROR_MESSAGE[code] ?? COUPON_GENERIC_FAILURE_MESSAGE
}

function readString(record: Record<string, unknown>, key: string): string | null {
  const value = record[key]

  return typeof value === 'string' && value !== '' ? value : null
}

/**
 * jsonb 를 판별 유니온으로 좁힌다.
 *
 * 타입 생성기는 RPC 반환을 `Json` 으로 내보내므로, 모양 검사는 런타임이 해야 한다.
 * 알 수 없는 모양은 실패(`unknown`)로 본다 — 성공으로 오해하면 지급되지 않은
 * 쿠폰을 "등록되었습니다" 로 알리게 된다.
 */
export function parseRedeemCouponResult(value: unknown): RedeemCouponResult {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return { ok: false, code: 'unknown' }
  }

  const record = value as Record<string, unknown>

  if (record.ok !== true) {
    return { ok: false, code: readString(record, 'code') ?? 'unknown' }
  }

  return {
    ok: true,
    redemptionId: readString(record, 'redemption_id'),
    couponName: readString(record, 'coupon_name') ?? '쿠폰',
    rewardNote: readString(record, 'reward_note'),
  }
}

/* -------------------------------------------------------------------------- */
/* 등록 이력 상태 · 안내 문구                                                  */
/* -------------------------------------------------------------------------- */

export type CouponRedemptionStatus = 'pending' | 'delivered' | 'rejected'

/** DB 의 `coupon_redemptions.status` CHECK 와 같은 값 집합. */
export const COUPON_STATUS_LABEL: Record<CouponRedemptionStatus, string> = {
  pending: '대기 중',
  delivered: '지급 완료',
  rejected: '거절',
}

/**
 * 상태 한 줄 설명.
 *
 * 라벨만으로는 "대기 중"이 무엇을 기다리는 것인지, "지급 완료"가 어디에 지급됐다는
 * 것인지 알 수 없다. 콘솔은 아이템을 주지 않고 **줬다고 적는다** — 실제 지급은 게임
 * 안에서 일어난다는 사실이 사용자 쪽 문구에도 그대로 있어야 문의가 줄어든다.
 */
export const COUPON_STATUS_HINT: Record<CouponRedemptionStatus, string> = {
  pending: '운영팀이 확인하고 있습니다.',
  delivered: '게임 안에서 지급을 마쳤습니다.',
  rejected: '지급되지 않았습니다.',
}

/**
 * 상태 배지 색 — 문의내역 표의 규칙을 따른다.
 *
 * '지급 완료'만 어두운 알약이다(시안 §6 의 "답변완료"). 끝난 일이 가장 진하면
 * 목록을 훑을 때 "받은 것/못 받은 것"이 먼저 읽힌다. '대기 중'은 아직 아무 일도
 * 일어나지 않은 상태라 테두리만 두고, '거절'은 회원 탈퇴 블록과 같은 경고색
 * (#c84545)의 옅은 면으로 둔다 — 빨간 알약을 통째로 쓰면 오류처럼 읽힌다.
 */
export const COUPON_STATUS_CLASS: Record<CouponRedemptionStatus, string> = {
  pending: 'border-line-soft text-ink-muted border bg-white',
  delivered: 'bg-ink text-white',
  rejected: 'border border-[#c84545]/25 bg-[#c84545]/10 text-[#c84545]',
}

export function toCouponStatus(value: string): CouponRedemptionStatus {
  return value === 'delivered' || value === 'rejected' ? value : 'pending'
}

/**
 * 처리 소요 기간 — **운영팀이 바꾸는 값**이다.
 *
 * 지급은 사람이 하고 그 속도는 운영 상황을 탄다. 화면 여러 곳에 흩어 두면 한 곳만
 * 고쳐진 채 서로 다른 약속이 남으므로, 사용자에게 보이는 기간 표기는 이 상수 하나가
 * 소유한다.
 */
export const COUPON_DELIVERY_TIMEFRAME = '1~3일'

/** 등록 내역 카드 머리의 한 줄 안내. */
export const COUPON_DELIVERY_NOTICE = `등록한 쿠폰은 운영팀 확인 후 게임 안에서 지급됩니다. 보통 ${COUPON_DELIVERY_TIMEFRAME} 걸립니다.`

/** 아직 처리되지 않은 건의 "처리일" 자리에 들어가는 문구. */
export const COUPON_PENDING_PROCESSED_TEXT = `아직 처리 전입니다. (보통 ${COUPON_DELIVERY_TIMEFRAME})`

/** 거절 사유가 비어 있을 때. 사유 없이 "거절"만 남기면 물어볼 곳이 없다. */
export const COUPON_REJECTED_FALLBACK_REASON = '자세한 사유는 고객지원으로 문의해 주세요.'
