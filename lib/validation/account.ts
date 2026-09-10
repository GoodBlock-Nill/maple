import { z } from 'zod'

import { mswProfileCodeSchema, mswUidSchema, updateAccountSchema } from '@/lib/validation/auth'

/**
 * 마이페이지 검증 — 이름 · 프로필 이미지 · 비밀번호 변경 · 쿠폰 등록.
 *
 * 닉네임·월드 계정 규칙은 `lib/validation/auth.ts` 가 계속 소유한다. 여기서 다시
 * 적으면 온보딩과 마이페이지가 서로 다른 규칙으로 갈린다.
 *
 * 클라이언트 검증은 편의일 뿐이다 — 서버 액션은 UI 를 거치지 않는 직접 POST 로도
 * 호출되므로(Next 16 문서) 같은 스키마로 서버에서 다시 파싱한다.
 */

/* -------------------------------------------------------------------------- */
/* 프로필                                                                      */
/* -------------------------------------------------------------------------- */

/** DB 제약 `profiles_name_length` 와 같은 값. */
export const NAME_MAX_LENGTH = 20

/**
 * 이름(실명, 선택).
 *
 * 빈 문자열을 허용하고 액션이 `null` 로 저장한다 — 한 번 적은 이름을 지울 수
 * 있어야 하고, 컬럼도 nullable 이다.
 */
export const nameSchema = z
  .string()
  .trim()
  .max(NAME_MAX_LENGTH, { message: `이름은 ${NAME_MAX_LENGTH}자 이하여야 합니다.` })

export const updateProfileSchema = updateAccountSchema.extend({ name: nameSchema })

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>

/* -------------------------------------------------------------------------- */
/* 프로필 이미지                                                               */
/* -------------------------------------------------------------------------- */

const MEGABYTE = 1024 * 1024

/** 버킷 `avatars` 의 `file_size_limit`(10MiB) 과 같은 값. 시안 안내 문구도 10MB 다. */
export const AVATAR_MAX_BYTES = 10 * MEGABYTE
export const AVATAR_MAX_MB = Math.floor(AVATAR_MAX_BYTES / MEGABYTE)

/**
 * 버킷의 `allowed_mime_types` 와 1:1 로 맞춘 목록.
 * 확장자는 서버가 MIME 에서 정한다 — 사용자가 보낸 파일명은 내용과 다를 수 있고,
 * 확장자가 틀리면 스토리지가 content-type 을 잘못 추론해 이미지가 다운로드로 떨어진다.
 */
export const AVATAR_MIME_EXTENSIONS = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
} as const

export type AvatarMime = keyof typeof AVATAR_MIME_EXTENSIONS

export function isAvatarMime(value: string): value is AvatarMime {
  return Object.hasOwn(AVATAR_MIME_EXTENSIONS, value)
}

export const AVATAR_EXTENSION_LABEL = 'PNG · JPG · WEBP'

/** 시안의 안내 문구. 검증 상수에서 만들어 안내와 실제 제한이 갈리지 않게 한다. */
export const AVATAR_HINT = `${AVATAR_MAX_MB}MB 이하의 PNG나 JPG 파일을 권장합니다.`

export type AvatarCheck = { ok: true; mime: AvatarMime } | { ok: false; message: string }

export function validateAvatarFile(file: { type: string; size: number }): AvatarCheck {
  if (file.size <= 0) {
    return { ok: false, message: '빈 파일은 올릴 수 없습니다.' }
  }

  if (!isAvatarMime(file.type)) {
    return { ok: false, message: `${AVATAR_EXTENSION_LABEL} 이미지만 올릴 수 있습니다.` }
  }

  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, message: `이미지는 ${AVATAR_MAX_MB}MB 이하만 올릴 수 있습니다.` }
  }

  return { ok: true, mime: file.type }
}

/* -------------------------------------------------------------------------- */
/* 비밀번호 변경                                                               */
/* -------------------------------------------------------------------------- */

/**
 * 비밀번호 규칙.
 *
 * 로그인이 간편로그인 전용이 되면서(2026-09-10 시안) 이메일 가입·재설정 화면과
 * 함께 `lib/validation/email-auth.ts` 가 사라졌다. 규칙을 쓰는 곳은 이제 이
 * 화면(마이페이지 비밀번호 변경)뿐이라 여기서 소유한다 — 이메일 계정으로 만들어진
 * 기존 회원이 비밀번호를 바꿀 수 있어야 한다.
 */

/** Supabase 기본 최소 길이(6)보다 강하게 잡는다. */
export const PASSWORD_MIN_LENGTH = 8

/** bcrypt 는 73바이트째부터 버린다. 뒤가 조용히 무시되지 않도록 여기서 끊는다. */
export const PASSWORD_MAX_LENGTH = 72

export const PASSWORD_RULE_MESSAGE = `비밀번호는 영문과 숫자를 포함해 ${PASSWORD_MIN_LENGTH}자 이상이어야 합니다.`

export const PASSWORD_MISMATCH_MESSAGE = '비밀번호가 일치하지 않습니다.'

export const SAME_PASSWORD_MESSAGE = '현재 비밀번호와 다른 비밀번호를 입력해 주세요.'

/** 길이 + 영문 + 숫자를 한 문장으로 알린다 — 한 번에 하나씩 고치게 하지 않는다. */
export function isStrongPassword(value: string): boolean {
  return (
    value.length >= PASSWORD_MIN_LENGTH &&
    value.length <= PASSWORD_MAX_LENGTH &&
    /\p{L}/u.test(value) &&
    /[0-9]/u.test(value)
  )
}

export const passwordSchema = z
  .string()
  .max(PASSWORD_MAX_LENGTH, `비밀번호는 ${PASSWORD_MAX_LENGTH}자를 넘을 수 없습니다.`)
  .refine((value) => isStrongPassword(value), { message: PASSWORD_RULE_MESSAGE })

/**
 * 비밀번호 변경 — 현재 비밀번호 + 새 비밀번호 + 확인.
 *
 * 새 비밀번호는 위 `passwordSchema` 를 그대로 쓴다. "현재 비밀번호"는
 * 형식을 검사하지 않는다(규칙이 강해지기 전에 만든 계정이 있다). 맞는지는 서버가
 * 재인증으로 확인한다.
 */
export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, { message: '현재 비밀번호를 입력해 주세요.' }),
    password: passwordSchema,
    passwordConfirm: z.string().min(1, { message: '새 비밀번호를 한 번 더 입력해 주세요.' }),
  })
  .refine((value) => value.password === value.passwordConfirm, {
    path: ['passwordConfirm'],
    message: PASSWORD_MISMATCH_MESSAGE,
  })
  .refine((value) => value.password !== value.currentPassword, {
    path: ['password'],
    message: SAME_PASSWORD_MESSAGE,
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>

/* -------------------------------------------------------------------------- */
/* 마케팅 수신 설정                                                            */
/* -------------------------------------------------------------------------- */

export const MARKETING_CHANNELS = ['sms', 'email'] as const

export type MarketingChannel = (typeof MARKETING_CHANNELS)[number]

export function isMarketingChannel(value: unknown): value is MarketingChannel {
  return MARKETING_CHANNELS.some((channel) => channel === value)
}

/** 채널 → `profiles` 컬럼. 화면과 DB 사이의 유일한 대응표다. */
export const MARKETING_COLUMN: Record<
  MarketingChannel,
  'marketing_sms_opt_out' | 'marketing_email_opt_out'
> = {
  sms: 'marketing_sms_opt_out',
  email: 'marketing_email_opt_out',
}

/* -------------------------------------------------------------------------- */
/* 쿠폰 등록                                                                   */
/* -------------------------------------------------------------------------- */

/** DB 제약 `coupons_code_shape` 와 같은 모양(대문자·숫자·하이픈 4~32자). */
const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,31}$/

export const COUPON_CODE_MESSAGE = '쿠폰 코드를 다시 확인해 주세요. (예: GLZA-TEST-0001)'

/**
 * 쿠폰 코드.
 *
 * 소문자로 치거나 붙여넣기에 공백이 섞여도 통과하도록 검증 전에 다듬는다
 * (공백 제거 → 대문자). 하이픈은 지우지 않는다 — 지우면 서로 다른 코드가 한 값으로
 * 뭉쳐 오타 등록이 통과한다(마이그레이션 20260910000100 의 `code_normalized` 와 동일).
 */
export const couponCodeSchema = z
  .string()
  .trim()
  .min(1, { message: '쿠폰 코드를 입력해 주세요.' })
  .transform((value) => value.replace(/\s+/gu, '').toUpperCase())
  .refine((value) => COUPON_CODE_PATTERN.test(value), { message: COUPON_CODE_MESSAGE })

/**
 * 쿠폰 등록 입력.
 *
 * UID·프로필 코드는 `FEATURES.mswAccountFields` 와 무관하게 **항상 필수**다 —
 * 보상은 월드 계정으로 지급되므로 두 값이 없으면 쿠폰을 처리할 수 없다.
 */
export const redeemCouponSchema = z.object({
  code: couponCodeSchema,
  mswUid: mswUidSchema,
  mswProfileCode: mswProfileCodeSchema,
})

export type RedeemCouponInput = z.infer<typeof redeemCouponSchema>
