import { z } from 'zod'

import type { UserRole } from '@/lib/supabase/types'

/**
 * 회원 관리(정지 · 닉네임 강제 변경 · 권한)의 검증과 파생 규칙.
 *
 * 이 모듈은 **순수 함수만** 담는다(`server-only` 를 붙이지 않는다). 상태 뱃지와
 * 이메일 마스킹은 서버 컴포넌트·클라이언트 다이얼로그·단위 테스트가 모두 같은
 * 규칙을 써야 하므로, 서버 전용 모듈에 두면 규칙이 화면마다 복제된다.
 */

/* 사용자 사이트(`lib/validation/auth.ts`)와 같은 값이어야 한다. 관리자가 강제로
   바꾼 닉네임도 당사자가 스스로 다시 입력할 수 있는 값이어야 하기 때문이다. */
export const NICKNAME_MIN_LENGTH = 2
export const NICKNAME_MAX_LENGTH = 12

export const SUSPENSION_REASON_MAX = 200

/** 영구 정지의 표현. `suspended_until` 이 nullable 이라 "무한대"를 담을 수 없어 먼 미래로 둔다. */
export const PERMANENT_SUSPENSION_UNTIL = '9999-12-31T00:00:00.000Z'

export const SUSPENSION_PERIODS = ['1', '3', '7', '30', 'permanent'] as const

export type SuspensionPeriod = (typeof SUSPENSION_PERIODS)[number]

export const SUSPENSION_PERIOD_OPTIONS: readonly { value: SuspensionPeriod; label: string }[] = [
  { value: '1', label: '1일' },
  { value: '3', label: '3일' },
  { value: '7', label: '7일' },
  { value: '30', label: '30일' },
  { value: 'permanent', label: '영구' },
]

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * 정지 종료 시각(UTC ISO).
 *
 * "지금부터 N일"로 계산한다. 자정 기준으로 끊으면 23:59 에 받은 1일 정지가 1분 만에
 * 풀린다 — 제재 길이가 접수 시각에 따라 달라지면 안 된다.
 */
export function suspensionUntil(period: SuspensionPeriod, now: Date = new Date()): string {
  if (period === 'permanent') {
    return PERMANENT_SUSPENSION_UNTIL
  }

  return new Date(now.getTime() + Number(period) * DAY_MS).toISOString()
}

export function isPermanentSuspension(until: string | null): boolean {
  if (until === null) {
    return false
  }

  // 연도만 본다. 밀리초 표기가 DB 왕복에서 달라져도(`+00` vs `.000Z`) 판정이 흔들리지 않는다.
  return new Date(until).getUTCFullYear() >= 9999
}

export function isSuspended(until: string | null, now: Date = new Date()): boolean {
  if (until === null) {
    return false
  }

  return new Date(until).getTime() > now.getTime()
}

export type MemberStatus = 'admin' | 'suspended' | 'normal'

/**
 * 목록·상세가 함께 쓰는 상태 판정.
 *
 * 관리자를 먼저 본다. 관리자는 `is_suspended()` 검사를 받는 쓰기 경로가 없어
 * 정지가 실효를 갖지 않으므로, 정지로 표시하면 운영자가 조치가 걸린 줄 착각한다.
 */
export function memberStatus(
  member: { role: UserRole; suspendedUntil: string | null },
  now: Date = new Date(),
): MemberStatus {
  if (member.role === 'admin') {
    return 'admin'
  }

  return isSuspended(member.suspendedUntil, now) ? 'suspended' : 'normal'
}

export const MEMBER_STATUS_LABEL: Record<MemberStatus, string> = {
  admin: '관리자',
  suspended: '정지',
  normal: '정상',
}

/**
 * 이메일 마스킹.
 *
 * 목록은 한 화면에 20명분 개인정보를 띄운다. 어깨너머로 새는 양을 줄이기 위해
 * 로컬 파트 앞 2글자만 남긴다. 도메인은 남긴다 — 공급자 구분이 운영 판단에 쓰인다.
 */
export function maskEmail(email: string | null | undefined): string {
  if (email === null || email === undefined || email.trim() === '') {
    return '-'
  }

  const trimmed = email.trim()
  const atIndex = trimmed.lastIndexOf('@')

  if (atIndex <= 0) {
    // 이메일 형태가 아니면 통째로 가린다. 형식을 신뢰하고 자르면 원문이 남는다.
    return '*'.repeat(Math.max(trimmed.length, 1))
  }

  const local = trimmed.slice(0, atIndex)
  const domain = trimmed.slice(atIndex)
  const visible = local.slice(0, local.length <= 2 ? 1 : 2)

  return `${visible}${'*'.repeat(Math.max(local.length - visible.length, 1))}${domain}`
}

const memberIdSchema = z.uuid({ message: '대상 회원을 찾을 수 없습니다.' })

const reasonSchema = z
  .string()
  .trim()
  .min(1, { message: '사유를 입력해 주세요.' })
  .max(SUSPENSION_REASON_MAX, {
    message: `사유는 ${SUSPENSION_REASON_MAX}자 이하로 입력해 주세요.`,
  })

export const suspendMemberSchema = z.object({
  memberId: memberIdSchema,
  period: z.enum(SUSPENSION_PERIODS, { message: '정지 기간을 선택해 주세요.' }),
  reason: reasonSchema,
})

export const unsuspendMemberSchema = z.object({
  memberId: memberIdSchema,
})

export const nicknameSchema = z
  .string()
  .trim()
  .min(NICKNAME_MIN_LENGTH, { message: `닉네임은 ${NICKNAME_MIN_LENGTH}자 이상이어야 합니다.` })
  .max(NICKNAME_MAX_LENGTH, { message: `닉네임은 ${NICKNAME_MAX_LENGTH}자 이하여야 합니다.` })
  .regex(/^[가-힣a-zA-Z0-9_]+$/u, {
    message: '닉네임은 한글·영문·숫자·밑줄만 사용할 수 있습니다.',
  })

export const changeNicknameSchema = z.object({
  memberId: memberIdSchema,
  nickname: nicknameSchema,
  reason: reasonSchema,
})

export const changeRoleSchema = z.object({
  memberId: memberIdSchema,
  role: z.enum(['user', 'admin'], { message: '잘못된 권한입니다.' }),
})

/** 목록 필터의 상태 값. `null` 은 "전체". */
export const MEMBER_STATUS_FILTERS = ['normal', 'suspended', 'admin'] as const

export type MemberStatusFilter = (typeof MEMBER_STATUS_FILTERS)[number]

/** 목록 필터의 가입 공급자. `email` 은 provider 가 null 인 계정까지 포함한다. */
export const MEMBER_PROVIDERS = ['kakao', 'google', 'naver', 'email'] as const

export type MemberProvider = (typeof MEMBER_PROVIDERS)[number]

export const MEMBER_PROVIDER_LABEL: Record<MemberProvider, string> = {
  kakao: '카카오',
  google: '구글',
  naver: '네이버',
  email: '이메일',
}

export function providerLabel(provider: string | null): string {
  if (provider === null || provider === '') {
    return MEMBER_PROVIDER_LABEL.email
  }

  return MEMBER_PROVIDER_LABEL[provider as MemberProvider] ?? provider
}
