import { MemberField } from '@/components/members/MemberField'
import { Card, CardBody, CardHeader } from '@/components/ui/Card'
import { formatDate, formatDateTime } from '@/lib/utils/format-date'
import {
  memberLifecycle,
  purgeCountdownLabel,
  purgeDueAt,
  PURGE_RETENTION_DAYS,
} from '@/lib/validation/member-status'

import type { LifecycleSource } from '@/lib/validation/member-status'

/**
 * 탈퇴 · 파기 카드.
 *
 * 정상 회원에게는 그리지 않는다 — 값이 전부 "-" 인 칸이 늘 붙어 있으면 실제로
 * 탈퇴한 회원의 카드가 눈에 띄지 않는다.
 *
 * **복구 이력은 적지 않는다.** 복구는 `deleted_at` 을 다시 비우는 것이라 별도
 * 기록이 남지 않는다(설계상 "상태값만 바뀐다"). 화면에 빈 칸을 만들어 두면
 * 운영자가 "복구한 적 없음"으로 읽으므로 감사 로그(`member.restore`)로 안내한다.
 */
export function MemberLifecycleCard({ deletedAt, purgedAt }: LifecycleSource) {
  const lifecycle = memberLifecycle({ deletedAt, purgedAt })

  if (lifecycle === 'active') {
    return null
  }

  const isPurged = lifecycle === 'purged'

  return (
    <Card className="mb-5">
      <CardHeader
        title={isPurged ? '개인정보 파기됨' : '탈퇴 대기'}
        description={
          isPurged
            ? '개인정보가 파기된 계정입니다. 작성 글·댓글은 남아 있습니다.'
            : `탈퇴일로부터 ${PURGE_RETENTION_DAYS}일 동안 개인정보를 보존합니다. 그 안에 본인이 다시 로그인하면 복구되고, 진행 중인 이용 제한은 그대로 적용됩니다.`
        }
      />

      <CardBody className="grid gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
        <MemberField label="탈퇴일" value={formatDateTime(deletedAt)} />
        <MemberField
          label="파기 예정일"
          value={purgeDue(deletedAt, isPurged)}
          tone={isPurged ? 'default' : 'danger'}
        />
        <MemberField label="파기일" value={formatDateTime(purgedAt)} />
      </CardBody>
    </Card>
  )
}

/** 파기 예정일 + 남은 일수. 이미 파기됐으면 남은 일수는 의미가 없으므로 날짜만 적는다. */
function purgeDue(deletedAt: string | null, isPurged: boolean): string {
  const due = formatDate(purgeDueAt(deletedAt))

  if (isPurged) {
    return due
  }

  const countdown = purgeCountdownLabel(deletedAt)

  return countdown === null ? due : `${due} (${countdown})`
}
