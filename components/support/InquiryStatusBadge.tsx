import { INQUIRY_STATUS_MAP } from '@/lib/constants/support'
import { cn } from '@/lib/utils/cn'

import type { InquiryStatus } from '@/types/domain'

type InquiryStatusBadgeProps = {
  status: InquiryStatus
  className?: string
}

/**
 * 문의 처리 상태 뱃지.
 *
 * 게시판 말머리(`Badge`)와 모양은 같지만 색 팔레트가 다르다(상태는 카테고리가
 * 아니다). `BadgeColor` 를 늘리는 대신 전용 컴포넌트를 두어, 말머리 색을 손대도
 * 상태 색이 따라 흔들리지 않게 한다.
 */
export function InquiryStatusBadge({ status, className }: InquiryStatusBadgeProps) {
  const option = INQUIRY_STATUS_MAP[status]

  return (
    <span
      className={cn(
        'rounded-pill inline-flex items-center justify-center px-2.5 py-[5px] text-[15px] leading-none font-medium whitespace-nowrap',
        option.className,
        className,
      )}
    >
      {option.label}
    </span>
  )
}
