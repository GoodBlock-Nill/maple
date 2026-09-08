/**
 * 관리자 화면 날짜 표기.
 *
 * 서버·클라이언트가 같은 문자열을 만들어야 하이드레이션 경고가 나지 않는다.
 * `toLocaleString` 은 런타임 로캘·타임존에 따라 결과가 갈리므로 쓰지 않고,
 * 한국 시간(UTC+9)으로 직접 환산해 고정 서식으로 찍는다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000

function toKstParts(value: string | Date): {
  year: number
  month: number
  day: number
  hour: number
  minute: number
} {
  const date = typeof value === 'string' ? new Date(value) : value
  const shifted = new Date(date.getTime() + KST_OFFSET_MS)

  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
  }
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

/** `2026-09-08` */
export function formatDate(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) {
    return '-'
  }

  const { year, month, day } = toKstParts(value)

  if (!Number.isFinite(year)) {
    return '-'
  }

  return `${year}-${pad(month)}-${pad(day)}`
}

/** `2026-09-08 17:04` */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (value === null || value === undefined) {
    return '-'
  }

  const { year, month, day, hour, minute } = toKstParts(value)

  if (!Number.isFinite(year)) {
    return '-'
  }

  return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}`
}

/** 목록의 "언제" 칸. 오늘이면 시:분, 아니면 날짜. */
export function formatRelativeDay(value: string | Date, now: Date = new Date()): string {
  const target = toKstParts(value)
  const today = toKstParts(now)

  if (target.year === today.year && target.month === today.month && target.day === today.day) {
    return `${pad(target.hour)}:${pad(target.minute)}`
  }

  return formatDate(value)
}
