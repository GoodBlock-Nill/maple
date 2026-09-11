import { InquiryAttachmentList } from '@/components/support/InquiryAttachmentList'
import { InquiryDetailMeta } from '@/components/support/InquiryDetailMeta'
import { InquiryOwnerActions } from '@/components/support/InquiryOwnerActions'
import { InquiryStatusBadge } from '@/components/support/InquiryStatusBadge'
import { SUPPORT_BOX_CLASS } from '@/components/support/support-styles'
import { resolveInquiryStatus } from '@/lib/constants/inquiry-status'
import { INQUIRY_CONTENT_HEADING } from '@/lib/constants/support'
import { cn } from '@/lib/utils/cn'

import type { InquiryDetail, SignedInquiryAttachment } from '@/types/domain'

type InquiryDetailCardProps = {
  inquiry: InquiryDetail
  attachments: readonly SignedInquiryAttachment[]
}

/**
 * 문의 본문 카드(제목 · 상태 · 메타 · 내용 · 첨부).
 *
 * 답변이 달린 문의에는 상태 알약을 그리지 않는다(시안 v2 pc-3) — 바로 아래
 * 답변 블록이 "답변 완료"를 이미 말하고 있어서, 같은 말을 두 번 하면 시선이
 * 답변에서 한 번 튄다. 알약을 벗는 상태 판정은 상태표(`variant`)가 들고 있다.
 *
 * 계정 ID 는 마스킹해서 그린다. 본인만 보는 화면이지만 화면 공유·어깨너머 노출이
 * 흔한 값이고, 접수 당시 무엇을 적었는지 확인하는 데는 앞뒤 몇 자면 충분하다.
 */
export function InquiryDetailCard({ inquiry, attachments }: InquiryDetailCardProps) {
  const status = resolveInquiryStatus(inquiry.status, inquiry.cancelledAt)

  return (
    <article className="flex flex-col">
      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-2">
          <h2 className="text-ink min-w-0 text-[20px] leading-[28px] font-medium lg:text-[24px] lg:leading-[34px] lg:font-semibold lg:tracking-[-0.7px]">
            {inquiry.title}
          </h2>
          {status.variant === 'pill' ? (
            <InquiryStatusBadge
              status={inquiry.status}
              cancelledAt={inquiry.cancelledAt}
              className="mt-1 ml-auto shrink-0 lg:mt-1.5 lg:ml-0"
            />
          ) : null}
        </div>

        <InquiryDetailMeta inquiry={inquiry} />
      </header>

      <div className="mt-3 h-px w-full bg-[#d9d9d9]" aria-hidden />

      {/* 소유자 액션은 본문 소제목과 같은 줄에 둔다 — 어느 글에 대한 동작인지
          제목이 아니라 "지금 보고 있는 내용" 옆에 있어야 오해가 없다. */}
      <div className="mt-5 flex items-center justify-between gap-3 lg:mt-7">
        <h3 className="text-ink text-[14px] leading-[20px] font-semibold lg:text-[16px] lg:leading-[22px]">
          {INQUIRY_CONTENT_HEADING}
        </h3>
        <InquiryOwnerActions
          inquiryId={inquiry.id}
          status={inquiry.status}
          cancelledAt={inquiry.cancelledAt}
        />
      </div>

      {/* 사용자가 입력한 평문. 줄바꿈만 살리고 마크업은 해석하지 않는다. */}
      <p
        className={cn(
          SUPPORT_BOX_CLASS,
          'mt-3 text-[14px] leading-[20px] font-medium break-words whitespace-pre-line text-[#727272] lg:text-[16px] lg:leading-[22px]',
        )}
      >
        {inquiry.content}
      </p>

      <InquiryAttachmentList attachments={attachments} />
    </article>
  )
}
