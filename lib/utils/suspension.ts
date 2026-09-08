import { formatDateIso } from '@/lib/utils/format-date'

/**
 * 계정 정지 안내 문구.
 *
 * 이 모듈은 **순수 함수만** 담는다(`server-only` 를 붙이지 않는다). 같은 문구를
 * 서버 액션(폼 오류)·서버 컴포넌트(배너)·클라이언트 컴포넌트(좋아요 버튼)가
 * 모두 써야 하므로, 서버 전용 모듈에 두면 규칙이 화면마다 복제된다.
 *
 * 판정 근거는 관리자 사이트가 쓰는 두 컬럼(`profiles.suspended_until` ·
 * `suspension_reason`)뿐이고, RLS(`profiles_select_self`)가 자기 행만 열어 주므로
 * **남의 정지 상태는 이 경로로 알 수 없다**. 호출부도 항상 "보고 있는 본인"의
 * 값만 넘겨야 한다.
 */

/** `describeSuspension` 이 필요로 하는 최소 상태. `CurrentUser` 가 이 모양을 만족한다. */
export type SuspensionState = {
  /** 정지 종료 시각(ISO). null 이면 제재 없음. */
  suspendedUntil: string | null
  suspensionReason: string | null
}

/**
 * 영구 정지의 경계.
 *
 * `suspended_until` 이 nullable 이라 "무한대"를 담을 수 없어 관리자 사이트가 먼
 * 미래(`9999-12-31T00:00:00.000Z`)를 넣는다. 날짜를 그대로 보여 주면 "9999년까지"
 * 라는 우스운 문구가 되므로 이 해부터는 "영구 정지"로 읽는다.
 */
export const PERMANENT_SUSPENSION_YEAR = 9999

/** 정지 안내의 첫 마디. 배너·폼 오류가 같은 말로 시작해야 사용자가 같은 사건으로 읽는다. */
export const SUSPENSION_TITLE = '정지된 계정입니다'

/** 이의 제기 경로. 정지 중에도 고객지원 문의는 열려 있다. */
export const SUSPENSION_SUPPORT_NOTICE = '문의는 고객지원에서 접수해 주세요.'

/**
 * 서버가 막았지만 정지 시각을 알 수 없을 때의 문구.
 *
 * 액션은 자기 판정과 별개로 DB 의 42501(RLS 위반)도 같은 사건으로 옮겨 적는다.
 * 그 사이 정지가 걸렸다면(우리가 읽은 프로필이 이미 낡았다) 기간을 말할 수 없다.
 */
export const SUSPENDED_WRITE_MESSAGE = `${SUSPENSION_TITLE}. ${SUSPENSION_SUPPORT_NOTICE}`

/** 지금 이 시각 기준으로 정지 중인가. 잘못된 값(파싱 불가)은 제재 없음으로 본다. */
export function isSuspended(suspendedUntil: string | null, now: number = Date.now()): boolean {
  if (suspendedUntil === null || suspendedUntil === '') {
    return false
  }

  const until = new Date(suspendedUntil).getTime()

  return !Number.isNaN(until) && until > now
}

function isPermanent(suspendedUntil: string): boolean {
  return new Date(suspendedUntil).getUTCFullYear() >= PERMANENT_SUSPENSION_YEAR
}

/**
 * 정지 안내 한 줄. 정지 중이 아니면 null 이다.
 *
 *   "정지된 계정입니다 (2026-09-11까지 · 사유: 욕설·비방)"
 *   "정지된 계정입니다 (영구 정지 · 사유: 욕설·비방)"
 *   "정지된 계정입니다 (2026-09-11까지)"            — 사유가 비어 있을 때
 *
 * 사유는 관리자가 사용자에게 보이는 문구로 적는다는 전제다
 * (마이그레이션 20260908001700 의 컬럼 주석).
 */
export function describeSuspension(
  suspendedUntil: string | null,
  suspensionReason: string | null,
  now: number = Date.now(),
): string | null {
  if (suspendedUntil === null || !isSuspended(suspendedUntil, now)) {
    return null
  }

  const period = isPermanent(suspendedUntil) ? '영구 정지' : `${formatDateIso(suspendedUntil)}까지`
  const reason = suspensionReason?.trim() ?? ''
  const detail = reason === '' ? period : `${period} · 사유: ${reason}`

  return `${SUSPENSION_TITLE} (${detail})`
}

/** 로그인 사용자(본인)의 정지 안내. 비로그인·정상 계정은 null. */
export function suspensionNotice(
  viewer: SuspensionState | null,
  now: number = Date.now(),
): string | null {
  if (viewer === null) {
    return null
  }

  return describeSuspension(viewer.suspendedUntil, viewer.suspensionReason, now)
}

/**
 * DB 가 막았을 때(42501) 폼에 돌려줄 문구.
 *
 * 우리가 읽은 프로필이 아직 정지 전이었더라도(그 사이 운영자가 정지시켰다) 사용자에게는
 * 같은 사건으로 읽혀야 하므로, 기간을 모르면 기간 없는 문구로 떨어진다.
 */
export function suspensionBlockedMessage(
  viewer: SuspensionState | null,
  now: number = Date.now(),
): string {
  return suspensionNotice(viewer, now) ?? SUSPENDED_WRITE_MESSAGE
}
