import Link from 'next/link'

import { InquiryStatusBadge } from '@/components/support/InquiryStatusBadge'
import { MY_INQUIRIES_PATH } from '@/lib/constants/support'
import { formatDateIso } from '@/lib/utils/format-date'
import { formatInquiryNo } from '@/lib/utils/inquiry-no'

import type { InquirySummary } from '@/types/domain'

type InquiryRowProps = {
  inquiry: InquirySummary
}

/** 시안의 흰 카드 리듬(radius 12 · border line-soft · shadow-chip)을 따르는 목록 행. */
const ROW_CLASS =
  'border-line-soft shadow-chip block rounded-[12px] border bg-white px-4 py-3 ' +
  'transition-[border-color,transform] duration-150 hover:border-ink/40 hover:-translate-y-0.5 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:px-5'

const META_CLASS = 'text-ink-muted text-[15px] leading-[19px] font-medium'

/**
 * 내 문의 한 줄.
 *
 * 모바일(390)에서는 제목 줄과 메타 줄이 각각 세로로 쌓인다. 상태 뱃지를 제목과
 * 같은 줄에 두면 긴 제목이 뱃지를 밀어내므로, 좁은 화면에서는 뱃지를 먼저 그린다.
 */
export function InquiryRow({ inquiry }: InquiryRowProps) {
  return (
    <Link href={`${MY_INQUIRIES_PATH}/${inquiry.id}`} className={ROW_CLASS}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <InquiryStatusBadge
          status={inquiry.status}
          cancelledAt={inquiry.cancelledAt}
          className="self-start sm:order-2"
        />
        <h3 className="text-ink text-body-lg line-clamp-2 min-w-0 flex-1 leading-[24px] font-medium sm:order-1 sm:line-clamp-1">
          {inquiry.title}
        </h3>
      </div>

      <p className={`${META_CLASS} mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1`}>
        {/* 접수번호가 먼저다 — 고객센터에 문의할 때 부르는 값이 이것뿐이다. */}
        <span className="text-ink font-semibold tabular-nums">
          <span className="sr-only">접수번호 </span>
          {formatInquiryNo(inquiry.inquiryNo)}
        </span>
        <span>
          {inquiry.category} · {inquiry.type}
        </span>
        <span>
          <span className="sr-only">등록일 </span>
          {formatDateIso(inquiry.createdAt)}
        </span>
        <span>답변 {inquiry.replyCount}</span>
      </p>
    </Link>
  )
}
