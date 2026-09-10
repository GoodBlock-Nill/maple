import { formatDateTime } from '@/lib/utils/format-date'

/**
 * 노출 기간 한 칸.
 *
 * 빈 쪽을 `-` 로 두면 "설정하지 않음"과 "조회 실패"가 같은 모양이 된다. 기간을 아예
 * 걸지 않은 쿠폰은 **상시**이므로 그렇게 적고, 한쪽만 있는 경우도 말로 푼다.
 * 시각은 관리자 화면 전체와 같은 한국시간 표기다(`lib/utils/format-date.ts`).
 */
export function CouponPeriod({
  startsAt,
  endsAt,
}: {
  startsAt: string | null
  endsAt: string | null
}) {
  if (startsAt === null && endsAt === null) {
    return <span className="text-muted">상시</span>
  }

  if (startsAt !== null && endsAt === null) {
    return <span className="text-muted">{formatDateTime(startsAt)}부터</span>
  }

  if (startsAt === null && endsAt !== null) {
    return <span className="text-muted">{formatDateTime(endsAt)}까지</span>
  }

  return (
    <span className="text-muted flex flex-col leading-snug">
      <span>{formatDateTime(startsAt)}</span>
      <span>~ {formatDateTime(endsAt)}</span>
    </span>
  )
}
