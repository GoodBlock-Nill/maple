const TIME_ZONE = 'Asia/Seoul'

function getDateParts(iso: string): Record<string, string> {
  const date = new Date(iso)
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })

  return Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]))
}

export function formatDateShort(iso: string): string {
  const { month, day } = getDateParts(iso)

  return `${month}-${day}`
}

export function formatDateLong(iso: string): string {
  const { year, month, day, hour, minute } = getDateParts(iso)

  return `${year}.${month}.${day} ${hour}:${minute}`
}

/** 목록/상세 메타에 쓰는 `YYYY-MM-DD` 표기. */
export function formatDateIso(iso: string): string {
  const { year, month, day } = getDateParts(iso)

  return `${year}-${month}-${day}`
}
