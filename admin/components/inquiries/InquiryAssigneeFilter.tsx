import { CONTROL_CLASS } from '@/components/inquiries/inquiry-filter-controls'
import {
  INQUIRY_ASSIGNEE_ME,
  INQUIRY_ASSIGNEE_NONE,
  inquiryAssigneeParam,
} from '@/lib/validation/inquiry-assignment'

import type { AdminListItem } from '@/lib/data/admins'
import type { InquiryAssigneeFilter as Filter } from '@/lib/validation/inquiry-assignment'

/**
 * 담당자 필터 — '내 담당' · '미배정' · 특정 운영자.
 *
 * 상태 탭과 달리 select 하나로 묶는다. 운영자 수만큼 버튼이 늘어나는 필터는
 * 두 명일 때는 편하고 여덟 명이 되면 못 쓴다.
 *
 * GET 폼의 일부라 값이 그대로 `?assignee=` 가 된다 — 새로고침·뒤로가기·링크 공유가
 * 같은 화면을 낸다(자바스크립트 없이 동작하는 것도 그대로다).
 */
export function InquiryAssigneeFilter({
  value,
  admins,
}: {
  value: Filter
  /** 배정 후보 = 관리자 전원. `/admins` 와 같은 출처다. */
  admins: readonly AdminListItem[]
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-ink text-[13px] font-semibold">담당자</span>
      <select
        name="assignee"
        defaultValue={inquiryAssigneeParam(value) ?? ''}
        className={CONTROL_CLASS}
      >
        <option value="">전체</option>
        <option value={INQUIRY_ASSIGNEE_ME}>내 담당</option>
        <option value={INQUIRY_ASSIGNEE_NONE}>미배정</option>
        {admins.map((admin) => (
          <option key={admin.id} value={admin.id}>
            {admin.nickname}
          </option>
        ))}
      </select>
    </label>
  )
}
