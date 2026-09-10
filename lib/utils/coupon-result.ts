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

export const COUPON_SUCCESS_MESSAGE = '쿠폰이 등록되었습니다. 보상은 순차 지급됩니다.'

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
/* 등록 이력 상태                                                              */
/* -------------------------------------------------------------------------- */

export type CouponRedemptionStatus = 'pending' | 'delivered' | 'rejected'

/** DB 의 `coupon_redemptions.status` CHECK 와 같은 값 집합. */
export const COUPON_STATUS_LABEL: Record<CouponRedemptionStatus, string> = {
  pending: '대기',
  delivered: '지급완료',
  rejected: '거절',
}

export const COUPON_STATUS_CLASS: Record<CouponRedemptionStatus, string> = {
  pending: 'bg-tray text-ink',
  delivered: 'bg-ink text-white',
  rejected: 'border-line-soft text-ink-muted border bg-page-sub',
}

export function toCouponStatus(value: string): CouponRedemptionStatus {
  return value === 'delivered' || value === 'rejected' ? value : 'pending'
}

/**
 * 쿠폰 코드 마스킹(`GLZA-TEST-0001` → `****-0001`).
 *
 * 지금은 일반 사용자에게 `coupons` select 정책이 없어 목록에서 코드를 읽을 수
 * 없다(코드 열거 차단). 정책이 열리는 날을 대비해 표기 규칙만 미리 둔다 — 뒤
 * 4자리만 남겨 "내가 등록한 그 쿠폰"을 알아볼 정도로만 보여 준다.
 */
export function maskCouponCode(code: string | null): string {
  const trimmed = (code ?? '').trim()

  if (trimmed === '') {
    return '-'
  }

  return `****-${trimmed.slice(-4)}`
}

/**
 * 등록 이력 한 줄의 제목.
 *
 * 이름 > 마스킹한 코드 > 중립 폴백 순이다. 지금은 정책상 앞의 둘이 모두 비어서
 * 늘 폴백이 나온다 — 그래도 "-" 같은 빈칸 대신 뜻이 있는 낱말을 둔다(사용자에게는
 * "무엇을 등록했는지 못 읽는다"가 아니라 "등록한 쿠폰 한 건"으로 보여야 한다).
 */
export function couponLabel(name: string | null, code: string | null): string {
  if (name !== null && name.trim() !== '') {
    return name
  }

  if (code !== null && code.trim() !== '') {
    return maskCouponCode(code)
  }

  return '쿠폰'
}
