import {
  isOnboardingComplete,
  ONBOARDING_PATH,
  RESTORE_PATH,
  sanitizePostAuthPath,
} from '@/lib/validation/auth'

import type { OnboardingStatusSource } from '@/lib/validation/auth'

/**
 * 회원 탈퇴 수명 주기 판정 — 순수 함수만 담는다(`server-only` 없음).
 *
 *   active ──탈퇴──▶ withdrawn(deleted_at) ──90일──▶ purged(purged_at)
 *            ◀──복구──┘
 *
 * 같은 규칙을 프록시 · 인증 콜백 · 서버 액션 · 페이지가 함께 써야 하므로 한 곳에
 * 둔다. 설계: docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md §3.
 */

/** 탈퇴 후 개인정보를 보존하는 기간(일). DB 함수 purge_withdrawn_profiles 의 기본값과 같다. */
export const WITHDRAWAL_RETENTION_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

/** 탈퇴 직후 홈에서 한 번 보여 주는 안내. `/?notice=withdrawn` 로 전달된다. */
export const WITHDRAWN_NOTICE_PARAM = 'notice'
export const WITHDRAWN_NOTICE_VALUE = 'withdrawn'
export const WITHDRAWN_NOTICE_MESSAGE = `탈퇴가 접수되었습니다. ${WITHDRAWAL_RETENTION_DAYS}일 안에 다시 로그인하면 계정이 복구됩니다.`

/**
 * 탈퇴 완료 모달의 제목(시안 v2 §3.3).
 *
 * 안내를 홈의 배너가 아니라 모달로 띄운다 — 탈퇴는 되돌리기 어려운 동작이라
 * "끝났다"는 사실을 한 번 막아서 알리는 편이 낫고, 시안도 모달이다. 문구는
 * 위 `WITHDRAWN_NOTICE_MESSAGE`(복구 기간 안내)를 본문으로 함께 보여 준다.
 */
export const WITHDRAWN_DIALOG_TITLE = '회원 탈퇴가 완료되었습니다.'

/** 탈퇴 확인 모달의 3요소 중 제목·설명(DEVELOPER-GUIDE §7.4). 문안은 오너 승인본 그대로다. */
export const WITHDRAW_DIALOG_TITLE = '회원 탈퇴'
export const WITHDRAW_DIALOG_DESCRIPTION =
  '탈퇴 후 90일 동안 개인정보가 보존되며, 그 안에 다시 로그인하면 복구됩니다. 90일이 지나면 이메일·간편로그인 정보·월드 계정 정보가 영구 삭제됩니다. 작성한 글과 댓글은 남고 ‘탈퇴한 회원’으로 표시됩니다. 진행 중인 이용 제한은 탈퇴해도 유지됩니다.'

/** 파기가 끝난 계정으로 어떻게든 로그인이 살아 있을 때(auth 삭제 실패 등)의 안내. */
export const PURGED_ACCOUNT_MESSAGE =
  '이 계정의 개인정보는 보존 기간이 지나 이미 파기되었습니다. 복구할 수 없으며, 로그아웃 후 새로 가입할 수 있습니다.'

/** 판정에 필요한 최소 프로필 모양. `profiles` 의 컬럼명을 그대로 쓴다. */
export type LifecycleSource = {
  deleted_at?: string | null
  purged_at?: string | null
}

function filled(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim() !== ''
}

/** 탈퇴 대기 또는 파기 완료 — deleted_at 이 있으면 어느 쪽이든 "정상 회원"이 아니다. */
export function isWithdrawnProfile(profile: LifecycleSource | null | undefined): boolean {
  return profile !== null && profile !== undefined && filled(profile.deleted_at)
}

export function isPurgedProfile(profile: LifecycleSource | null | undefined): boolean {
  return profile !== null && profile !== undefined && filled(profile.purged_at)
}

/** 다시 로그인한 사람이 복구할 수 있는가 — 탈퇴 대기 중이고 아직 파기되지 않았을 때만. */
export function canRestoreProfile(profile: LifecycleSource | null | undefined): boolean {
  return isWithdrawnProfile(profile) && !isPurgedProfile(profile)
}

/** 탈퇴 후 지난 날수(내림). 잘못된 값이면 0. 복구 안내 문구("N일이 지났습니다")에 쓴다. */
export function daysSinceWithdrawal(
  deletedAt: string | null | undefined,
  now = Date.now(),
): number {
  if (!filled(deletedAt)) {
    return 0
  }

  const then = new Date(deletedAt).getTime()

  if (Number.isNaN(then)) {
    return 0
  }

  return Math.max(0, Math.floor((now - then) / DAY_MS))
}

/** 복구 화면의 본문. */
export function restoreNotice(deletedAt: string | null | undefined, now = Date.now()): string {
  return `탈퇴 후 ${daysSinceWithdrawal(deletedAt, now)}일이 지났습니다. 계속하면 계정이 복구됩니다. 이용 제한이 있었다면 그대로 적용됩니다.`
}

/**
 * 로그인 직후(또는 보호 경로 진입 시) 갈 곳.
 *
 * 순서가 중요하다 — 탈퇴 상태가 온보딩보다 먼저다. 탈퇴 대기 중인 사람에게 온보딩
 * 폼을 먼저 보이면 "복구할지"를 묻기 전에 약관 동의를 다시 받는 셈이 된다.
 *
 *   1) deleted_at 있음 → /auth/restore?next=…  (파기된 계정도 이 화면이 사유를 알린다)
 *   2) 온보딩 미완료   → /auth/onboarding?next=…
 *   3) 그 외           → next
 */
export function resolvePostAuthDestination(
  profile: (LifecycleSource & OnboardingStatusSource) | null | undefined,
  next: unknown,
): string {
  const nextPath = sanitizePostAuthPath(next)

  if (isWithdrawnProfile(profile)) {
    return `${RESTORE_PATH}?next=${encodeURIComponent(nextPath)}`
  }

  if (isOnboardingComplete(profile)) {
    return nextPath
  }

  return `${ONBOARDING_PATH}?next=${encodeURIComponent(nextPath)}`
}
