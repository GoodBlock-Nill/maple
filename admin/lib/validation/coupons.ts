import { z } from 'zod'

import { firstValue, type QueryParams } from '@/lib/utils/table-query'
import {
  COUPON_CODE_MAX_LENGTH,
  COUPON_CODE_MIN_LENGTH,
  isCouponCode,
  normalizeCouponCode,
} from '@/lib/validation/coupon-code'

/**
 * 쿠폰 화면의 입력 계약 — 등록·수정 폼, 목록 필터, 상태 판정.
 *
 * 서버 액션은 클라이언트 검증을 신뢰하지 않고 여기서 다시 파싱한다. 상태(활성 ·
 * 비활성 · 시작 전 · 기간 만료)는 **컬럼이 아니라 파생값**이다 — DB 에 상태 열을 두면
 * 기간이 지날 때마다 배치가 돌아야 하고, 그 배치가 멈추면 화면과 `redeem_coupon()`
 * 의 판정이 갈린다. 그래서 화면도 RPC 와 같은 식(`is_active` + 기간)으로 계산한다.
 *
 * 코드 자체의 규칙은 의존성 없는 `coupon-code.ts` 가 갖고 여기서 다시 내보낸다 —
 * 기존 임포트 경로를 그대로 쓰게 하면서 이 파일의 300줄 상한을 지키기 위해서다.
 */

export * from '@/lib/validation/coupon-code'

export const COUPON_NAME_MAX_LENGTH = 60
export const COUPON_DESCRIPTION_MAX_LENGTH = 300
export const COUPON_REWARD_NOTE_MAX_LENGTH = 200
export const COUPON_PER_USER_LIMIT_MAX = 100
export const COUPON_MAX_REDEMPTIONS_MAX = 1_000_000
export const COUPON_SEARCH_MAX_LENGTH = 60

/* -------------------------------------------------------------------------
 * 상태 (파생값)
 * ---------------------------------------------------------------------- */

export const COUPON_STATUSES = ['active', 'scheduled', 'expired', 'inactive'] as const

export type CouponStatus = (typeof COUPON_STATUSES)[number]

export const COUPON_STATUS_LABELS: Record<CouponStatus, string> = {
  active: '활성',
  scheduled: '시작 전',
  expired: '기간 만료',
  inactive: '비활성',
}

export type CouponWindow = {
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
}

/**
 * 쿠폰 상태 판정.
 *
 * 판정 순서가 곧 운영자에게 보여 줄 "지금 왜 안 되는가"의 우선순위다. 꺼 둔 쿠폰은
 * 기간이 어떻든 비활성이고(운영 결정이 기간보다 세다), 켜져 있는 쿠폰만 기간을 본다.
 * `redeem_coupon()` 도 같은 순서로 거른다 — 비활성이면 기간을 보기 전에 떨어진다.
 */
export function deriveCouponStatus(coupon: CouponWindow, now: Date = new Date()): CouponStatus {
  if (!coupon.isActive) {
    return 'inactive'
  }

  const current = now.getTime()

  if (coupon.startsAt !== null && current < new Date(coupon.startsAt).getTime()) {
    return 'scheduled'
  }

  if (coupon.endsAt !== null && current >= new Date(coupon.endsAt).getTime()) {
    return 'expired'
  }

  return 'active'
}

/** 지금 이 코드를 등록할 수 있는가. 상세 화면의 안내 문구가 이 값으로 갈린다. */
export function isCouponRedeemable(status: CouponStatus): boolean {
  return status === 'active'
}

/* -------------------------------------------------------------------------
 * 한국시간 ↔ `datetime-local`
 * ---------------------------------------------------------------------- */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/

/**
 * `datetime-local` 값을 UTC ISO 로 옮긴다.
 *
 * 브라우저의 `datetime-local` 은 **타임존이 없는 문자열**이라 `new Date(value)` 는
 * 실행 환경의 로컬 시간으로 읽는다. 서버가 UTC 인 배포에서는 운영자가 적은 시각이
 * 9시간 밀린다. 그래서 한국시간(+09:00)으로 못 박아 해석한다 — 관리자 화면의
 * 모든 시각 표기가 이미 한국시간이다(`lib/utils/format-date.ts`).
 */
export function kstLocalToIso(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim()

  if (!DATETIME_LOCAL_PATTERN.test(trimmed)) {
    return null
  }

  const withSeconds = trimmed.length === 16 ? `${trimmed}:00` : trimmed
  const parsed = new Date(`${withSeconds}+09:00`)

  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

/** UTC ISO → `datetime-local` 기본값(한국시간). 값이 없으면 빈 칸. */
export function isoToKstLocal(value: string | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return ''
  }

  const parsed = new Date(value)

  if (Number.isNaN(parsed.getTime())) {
    return ''
  }

  return new Date(parsed.getTime() + KST_OFFSET_MS).toISOString().slice(0, 16)
}

/* -------------------------------------------------------------------------
 * 폼 스키마
 * ---------------------------------------------------------------------- */

/** 빈 문자열은 "입력하지 않음"이다. 트림한 뒤에도 비어 있으면 null 로 저장한다. */
function optionalText(max: number, tooLongMessage: string) {
  return z
    .string()
    .transform((value) => value.replace(/\r\n/g, '\n').trim())
    .pipe(z.string().max(max, tooLongMessage))
    .transform((value) => (value === '' ? null : value))
}

/** 빈 칸이면 null(= 제한 없음), 값이 있으면 1 이상의 정수. */
const optionalCount = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    if (value === '') {
      return
    }

    if (!/^\d+$/.test(value)) {
      ctx.addIssue({ code: 'custom', message: '숫자만 입력해 주세요.' })

      return
    }

    const parsed = Number.parseInt(value, 10)

    if (parsed < 1 || parsed > COUPON_MAX_REDEMPTIONS_MAX) {
      ctx.addIssue({
        code: 'custom',
        message: `1 이상 ${COUPON_MAX_REDEMPTIONS_MAX.toLocaleString('ko-KR')} 이하로 입력해 주세요.`,
      })
    }
  })
  .transform((value) => (value === '' ? null : Number.parseInt(value, 10)))

const datetimeField = z
  .string()
  .transform((value) => value.trim())
  .superRefine((value, ctx) => {
    if (value !== '' && kstLocalToIso(value) === null) {
      ctx.addIssue({ code: 'custom', message: '날짜와 시각을 다시 선택해 주세요.' })
    }
  })
  .transform((value) => (value === '' ? null : kstLocalToIso(value)))

export const couponSchema = z
  .object({
    code: z
      .string()
      .transform(normalizeCouponCode)
      .superRefine((value, ctx) => {
        if (value === '') {
          ctx.addIssue({ code: 'custom', message: '쿠폰 코드를 입력해 주세요.' })

          return
        }

        if (!isCouponCode(value)) {
          ctx.addIssue({
            code: 'custom',
            message: `영문 대문자 · 숫자 · 하이픈만 ${COUPON_CODE_MIN_LENGTH}~${COUPON_CODE_MAX_LENGTH}자로 입력해 주세요.`,
          })
        }
      }),
    name: z
      .string()
      .transform((value) => value.trim())
      .pipe(
        z
          .string()
          .min(1, '쿠폰 이름을 입력해 주세요.')
          .max(COUPON_NAME_MAX_LENGTH, `이름은 ${COUPON_NAME_MAX_LENGTH}자를 넘을 수 없습니다.`),
      ),
    description: optionalText(
      COUPON_DESCRIPTION_MAX_LENGTH,
      `설명은 ${COUPON_DESCRIPTION_MAX_LENGTH}자를 넘을 수 없습니다.`,
    ),
    rewardNote: optionalText(
      COUPON_REWARD_NOTE_MAX_LENGTH,
      `지급 내용은 ${COUPON_REWARD_NOTE_MAX_LENGTH}자를 넘을 수 없습니다.`,
    ),
    startsAt: datetimeField,
    endsAt: datetimeField,
    maxRedemptions: optionalCount,
    perUserLimit: z
      .string()
      .transform((value) => value.trim())
      .superRefine((value, ctx) => {
        if (!/^\d+$/.test(value)) {
          ctx.addIssue({ code: 'custom', message: '1인 등록 횟수를 숫자로 입력해 주세요.' })

          return
        }

        const parsed = Number.parseInt(value, 10)

        if (parsed < 1 || parsed > COUPON_PER_USER_LIMIT_MAX) {
          ctx.addIssue({
            code: 'custom',
            message: `1 이상 ${COUPON_PER_USER_LIMIT_MAX} 이하로 입력해 주세요.`,
          })
        }
      })
      .transform((value) => Number.parseInt(value, 10)),
    isActive: z.boolean(),
  })
  /* 기간이 뒤집힌 쿠폰은 아무도 등록할 수 없다. DB CHECK(coupons_window)도 같은 것을
     막지만, 거기서 걸리면 운영자는 제약명이 섞인 문장을 보게 된다. */
  .refine(
    (value) => value.startsAt === null || value.endsAt === null || value.endsAt > value.startsAt,
    { path: ['endsAt'], message: '종료 시각은 시작 시각보다 뒤여야 합니다.' },
  )

export type CouponInput = z.infer<typeof couponSchema>

export const couponActiveSchema = z.object({
  couponId: z.uuid('쿠폰을 찾을 수 없습니다.'),
  isActive: z.boolean(),
})

export const couponDeleteSchema = z.object({
  couponId: z.uuid('쿠폰을 찾을 수 없습니다.'),
})

/* -------------------------------------------------------------------------
 * 목록 필터 (URL 상태)
 * ---------------------------------------------------------------------- */

export type CouponFilters = {
  /** null 이면 전체. */
  status: CouponStatus | null
  search: string | null
}

/**
 * 검색어 정리.
 *
 * PostgREST 의 `or(...)` 는 쉼표·괄호를 문법으로 읽고, ilike 패턴에서 `%`·`_` 는
 * 와일드카드다. 그대로 흘려보내면 검색어 하나로 질의가 깨진다(문의 목록과 같은 규칙).
 */
export function sanitizeCouponSearch(raw: string | string[] | undefined): string | null {
  const value = firstValue(raw)

  if (value === null) {
    return null
  }

  const cleaned = value
    .replace(/[,()%_*\\"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, COUPON_SEARCH_MAX_LENGTH)

  return cleaned === '' ? null : cleaned
}

export function isCouponStatus(value: string | null | undefined): value is CouponStatus {
  return typeof value === 'string' && (COUPON_STATUSES as readonly string[]).includes(value)
}

export function parseCouponFilters(params: QueryParams): CouponFilters {
  const status = firstValue(params.status)

  return {
    // 모르는 값은 필터를 걸지 않는다(= 전체). 임의 문자열이 질의로 흘러가지 않게 한다.
    status: isCouponStatus(status) ? status : null,
    search: sanitizeCouponSearch(params.q),
  }
}
