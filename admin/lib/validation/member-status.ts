/**
 * 탈퇴 · 파기 상태(생애주기)의 판정과 파생 계산.
 *
 * 탈퇴는 두 단계다(`docs/admin/ACCOUNT-WITHDRAWAL-PLAN.md` §3).
 *
 *   `active`    — 정상. `deleted_at` 이 비어 있다.
 *   `withdrawn` — 탈퇴 요청 후 보존 기간(90일) 중. 개인정보는 아직 남아 있고,
 *                 본인이 다시 로그인하면 상태값만 되돌아온다. **제재도 그대로다.**
 *   `purged`    — 보존 기간이 지나(또는 즉시 파기로) 개인정보가 지워진 상태.
 *                 프로필 행은 남아 글·댓글의 작성자 연결이 끊기지 않는다.
 *
 * 이 모듈은 `lib/validation/members.ts` 와 같은 이유로 **순수 함수만** 담는다 —
 * 목록(서버 컴포넌트) · 상세 · 확인 다이얼로그(클라이언트) · 단위 테스트가 같은
 * 규칙을 써야 하므로 서버 전용 모듈에 두면 D-day 계산이 화면마다 복제된다.
 */

/** 탈퇴 후 개인정보를 보존하는 기간. 파기 배치·개인정보처리방침과 같은 값이어야 한다. */
export const PURGE_RETENTION_DAYS = 90

const DAY_MS = 24 * 60 * 60 * 1000

export type MemberLifecycle = 'active' | 'withdrawn' | 'purged'

/** 판정에 필요한 최소 입력. 목록 행·상세 프로필이 그대로 넘길 수 있는 모양이다. */
export type LifecycleSource = {
  deletedAt: string | null
  purgedAt: string | null
}

export const MEMBER_LIFECYCLE_LABEL: Record<MemberLifecycle, string> = {
  active: '정상',
  withdrawn: '탈퇴 대기',
  purged: '삭제됨',
}

/**
 * 생애주기 판정.
 *
 * **파기가 탈퇴를 이긴다.** 파기된 계정은 `deleted_at` 도 함께 남아 있는데(언제
 * 탈퇴했는지가 기록이다), 탈퇴로 표시하면 운영자가 "아직 복구할 수 있다"고 읽는다.
 * 파기 배치가 `deleted_at` 을 비우지 않는 이유이기도 하다.
 */
export function memberLifecycle(source: LifecycleSource): MemberLifecycle {
  if (source.purgedAt !== null) {
    return 'purged'
  }

  return source.deletedAt === null ? 'active' : 'withdrawn'
}

/** 개인정보 파기 예정 시각(UTC ISO). 탈퇴하지 않았으면 `null`. */
export function purgeDueAt(deletedAt: string | null): string | null {
  if (deletedAt === null) {
    return null
  }

  const deleted = new Date(deletedAt).getTime()

  if (!Number.isFinite(deleted)) {
    return null
  }

  return new Date(deleted + PURGE_RETENTION_DAYS * DAY_MS).toISOString()
}

/**
 * 파기까지 남은 일수(D-nn 의 nn).
 *
 * 올림으로 센다 — 남은 시간이 반나절이어도 "0일 남음"으로 적으면 운영자가 이미
 * 지난 것으로 읽는다. 예정일이 지났는데 배치가 아직 돌지 않은 구간은 0 으로 눌러
 * 음수가 화면에 나오지 않게 한다.
 */
export function daysUntilPurge(deletedAt: string | null, now: Date = new Date()): number | null {
  const due = purgeDueAt(deletedAt)

  if (due === null) {
    return null
  }

  const remaining = Math.ceil((new Date(due).getTime() - now.getTime()) / DAY_MS)

  return Math.max(remaining, 0)
}

/** `D-90`. 탈퇴하지 않았으면 `null`. */
export function purgeCountdownLabel(
  deletedAt: string | null,
  now: Date = new Date(),
): string | null {
  const days = daysUntilPurge(deletedAt, now)

  return days === null ? null : `D-${days}`
}

/**
 * 목록·상세의 상태 칸에 적을 문구.
 *
 * 탈퇴 대기만 남은 일수를 붙인다 — 파기 예정일이 조치의 마감이라, 숫자가 없으면
 * 운영자가 목록에서 우선순위를 매길 수 없다.
 */
export function lifecycleLabel(source: LifecycleSource, now: Date = new Date()): string {
  const lifecycle = memberLifecycle(source)

  if (lifecycle !== 'withdrawn') {
    return MEMBER_LIFECYCLE_LABEL[lifecycle]
  }

  return `${MEMBER_LIFECYCLE_LABEL.withdrawn} ${purgeCountdownLabel(source.deletedAt, now)}`
}

/**
 * 파기된 계정의 표시 이름.
 *
 * 파기 배치가 닉네임을 `탈퇴한 회원#<짧은 id>` 로 바꾼다(고유 인덱스와 충돌하지
 * 않게 하려는 것). 관리자 화면은 그 값을 **그대로** 보여 준다 — 사용자 사이트처럼
 * 고정 문구로 뭉개면 목록에서 여러 파기 계정을 구분할 수 없다.
 */
export function purgedNickname(memberId: string): string {
  return `탈퇴한 회원#${memberId.slice(0, 8)}`
}
