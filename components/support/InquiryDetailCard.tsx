import { InquiryAttachmentList } from '@/components/support/InquiryAttachmentList'
import { InquiryOwnerActions } from '@/components/support/InquiryOwnerActions'
import { InquiryStatusBadge } from '@/components/support/InquiryStatusBadge'
import { formatDateLong } from '@/lib/utils/format-date'
import { maskAccountId } from '@/lib/utils/mask'

import type { InquiryDetail, SignedInquiryAttachment } from '@/types/domain'

type InquiryDetailCardProps = {
  inquiry: InquiryDetail
  attachments: readonly SignedInquiryAttachment[]
}

/**
 * 문의 본문 카드(제목 · 상태 · 메타 · 내용 · 첨부).
 *
 * 계정 ID 는 마스킹해서 그린다. 본인만 보는 화면이지만 화면 공유·어깨너머 노출이
 * 흔한 값이고, 접수 당시 무엇을 적었는지 확인하는 데는 앞뒤 몇 자면 충분하다.
 */
export function InquiryDetailCard({ inquiry, attachments }: InquiryDetailCardProps) {
  return (
    <article className="flex flex-col gap-5">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h2 className="text-ink min-w-0 text-title-md leading-[1.35] font-medium">
            {inquiry.title}
          </h2>
          {/* 뱃지와 소유자 액션(수정 · 접수 취소)은 한 열로 묶는다. 좁은 화면에서
              둘이 떨어지면 어느 문의에 대한 동작인지 읽기 어려워진다. */}
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <InquiryStatusBadge status={inquiry.status} cancelledAt={inquiry.cancelledAt} />
            <InquiryOwnerActions
              inquiryId={inquiry.id}
              status={inquiry.status}
              cancelledAt={inquiry.cancelledAt}
            />
          </div>
        </div>

        <dl className="text-ink-muted flex flex-wrap gap-x-5 gap-y-1 text-[15px] font-medium">
          <MetaItem label="등록일" value={formatDateLong(inquiry.createdAt)} />
          <MetaItem label="카테고리" value={`${inquiry.category} · ${inquiry.type}`} />
          <MetaItem label="계정 ID" value={maskAccountId(inquiry.accountId)} />
        </dl>
      </header>

      <div className="bg-line h-px w-full" aria-hidden />

      {/* 사용자가 입력한 평문. 줄바꿈만 살리고 마크업은 해석하지 않는다. */}
      <p className="text-ink text-prose leading-[1.8] break-words whitespace-pre-line">
        {inquiry.content}
      </p>

      <InquiryAttachmentList attachments={attachments} />
    </article>
  )
}

type MetaItemProps = {
  label: string
  value: string
}

function MetaItem({ label, value }: MetaItemProps) {
  return (
    <div className="flex items-center gap-1.5">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-ink">{value}</dd>
    </div>
  )
}
