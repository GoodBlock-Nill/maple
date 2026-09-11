import Link from 'next/link'

import { ChevronRightSmallIcon } from '@/components/support/support-icons'
import { InquiryStatusBadge } from '@/components/support/InquiryStatusBadge'
import { MY_INQUIRIES_PATH } from '@/lib/constants/support'
import { formatDateIso } from '@/lib/utils/format-date'
import { formatInquiryNoLabel } from '@/lib/utils/inquiry-no'

import type { InquirySummary } from '@/types/domain'

type InquiryRowProps = {
  inquiry: InquirySummary
}

/** 시안 v2 의 행 카드(radius 16 · border line-soft · shadow-chip · padding 16/24). */
const ROW_CLASS =
  'border-line-soft shadow-chip flex flex-col gap-2 rounded-[16px] border bg-white p-4 ' +
  'transition-[border-color,transform] duration-150 hover:border-ink/40 hover:-translate-y-0.5 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'lg:px-6 lg:py-4'

const META_CLASS =
  'text-[13px] leading-[18px] font-medium text-[#727272] lg:text-[14px] lg:leading-[20px]'

/**
 * 내 문의 한 줄.
 *
 * 제목 줄 오른쪽 끝이 접수번호다 — 고객센터에 문의할 때 부르는 값이라 목록에서도
 * 늘 같은 자리에 있어야 한다. 상태는 좁은 화면에서 메타 줄 오른쪽 끝으로 밀린다
 * (카테고리·날짜와 한 줄에 붙여 두면 320~390px 에서 줄이 접힌다).
 */
export function InquiryRow({ inquiry }: InquiryRowProps) {
  return (
    <Link href={`${MY_INQUIRIES_PATH}/${inquiry.id}`} className={ROW_CLASS}>
      <div className="flex items-center gap-3">
        <h3 className="text-ink min-w-0 flex-1 truncate text-[16px] leading-[22px] font-medium lg:text-[18px] lg:leading-[26px]">
          {inquiry.title}
        </h3>
        <span className="shrink-0 text-[12px] leading-[18px] font-medium text-[#727272] tabular-nums lg:text-[13px]">
          <span className="sr-only">접수번호 </span>
          {formatInquiryNoLabel(inquiry.inquiryNo)}
        </span>
      </div>

      {/* 줄 높이를 글줄에 고정한다 — 상태 알약(26)이 줄을 밀면 행이 시안보다
          9px 높아진다(시안은 알약이 20 줄 위아래로 3씩 넘치는 모양이다). */}
      <div className={`${META_CLASS} flex h-[18px] items-center gap-3 lg:h-5`}>
        <span className="flex min-w-0 items-center gap-1">
          <span className="truncate">{inquiry.category}</span>
          <ChevronRightSmallIcon className="text-line-soft size-3.5 shrink-0 lg:size-4" />
          <span className="truncate">{inquiry.type}</span>
        </span>
        <span className="shrink-0">
          <span className="sr-only">등록일 </span>
          {formatDateIso(inquiry.createdAt)}
        </span>
        <InquiryStatusBadge
          status={inquiry.status}
          cancelledAt={inquiry.cancelledAt}
          className="ml-auto shrink-0 lg:ml-0"
        />
      </div>
    </Link>
  )
}
