import { resolveInquiryStatus } from '@/lib/constants/inquiry-status'
import { cn } from '@/lib/utils/cn'

import type { InquiryStatus } from '@/types/domain'

type InquiryStatusBadgeProps = {
  status: InquiryStatus
  /** 취소 시각. 값이 있으면 "종료" 대신 "접수 취소"로 그린다. */
  cancelledAt?: string | null
  className?: string
}

/**
 * 문의 처리 상태 뱃지.
 *
 * 게시판 말머리(`Badge`)와 모양은 같지만 색 팔레트가 다르다(상태는 카테고리가
 * 아니다). `BadgeColor` 를 늘리는 대신 전용 컴포넌트를 두어, 말머리 색을 손대도
 * 상태 색이 따라 흔들리지 않게 한다.
 *
 * 시안 v2 에서 **답변 완료만 알약을 벗고 분홍 글자**가 됐다. 모양 판정은 상태표
 * (`InquiryStatusOption.variant`)가 들고 있어 목록·상세가 같은 규칙을 본다.
 *
 * 사용자가 스스로 취소한 문의는 DB 에 종료(closed)로 저장되므로, 라벨 판정은
 * 상태와 `cancelled_at` 을 함께 보는 `resolveInquiryStatus()` 에 맡긴다.
 */
export function InquiryStatusBadge({
  status,
  cancelledAt = null,
  className,
}: InquiryStatusBadgeProps) {
  const option = resolveInquiryStatus(status, cancelledAt)

  return (
    <span
      className={cn(
        'inline-flex items-center justify-center font-medium whitespace-nowrap',
        option.variant === 'pill'
          ? 'rounded-pill px-2 py-1 text-[12px] leading-[18px] lg:text-[13px]'
          : 'text-[13px] leading-[18px] lg:text-[14px] lg:leading-[20px]',
        option.className,
        className,
      )}
    >
      {option.label}
    </span>
  )
}
