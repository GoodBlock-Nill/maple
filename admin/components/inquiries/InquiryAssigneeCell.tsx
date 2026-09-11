import { PencilIcon } from '@/components/inquiries/inquiry-icons'
import { Badge } from '@/components/ui'

import type { InquiryListItem } from '@/lib/data/inquiries'

/**
 * 목록의 담당자 칸.
 *
 * "미배정"을 흐린 글씨가 아니라 **경고 톤 뱃지**로 세운다 — 이 목록에서 가장 먼저
 * 눈에 띄어야 하는 것이 "아무도 안 맡은 문의"이기 때문이다.
 *
 * 아래 줄의 "작성 중"은 살아 있는 잠금이 있을 때만 나온다(만료 판정은 조회 계층이
 * 한 번만 한다). 담당자와 다른 사람이 쓰고 있는 경우가 실제로 있으므로 두 값을
 * 겹치지 않고 나란히 보여 준다.
 */
export function InquiryAssigneeCell({ row }: { row: InquiryListItem }) {
  return (
    <span className="flex flex-col items-start gap-1">
      {row.assignee === null ? (
        <Badge tone="warn">미배정</Badge>
      ) : (
        <span className="text-ink truncate">{row.assignee.nickname}</span>
      )}
      {row.editing !== null && (
        <span
          className="text-warn flex items-center gap-1 text-[12px] whitespace-nowrap"
          title={`${row.editing.nickname} 관리자가 답변을 작성하고 있습니다`}
          data-testid="inquiry-editing"
        >
          <PencilIcon />
          작성 중 · {row.editing.nickname}
        </span>
      )}
    </span>
  )
}
