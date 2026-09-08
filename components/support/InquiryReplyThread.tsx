import {
  INQUIRY_CANCELLED_NO_REPLY_NOTICE,
  INQUIRY_CLOSED_NO_REPLY_NOTICE,
  INQUIRY_IN_PROGRESS_NO_REPLY_NOTICE,
  INQUIRY_NO_REPLY_NOTICE,
  INQUIRY_REPLY_HEADING,
} from '@/lib/constants/support'
import { isInquiryCancelled } from '@/lib/utils/inquiry-permissions'
import { formatDateLong } from '@/lib/utils/format-date'

import type { InquiryReply, InquiryStatus } from '@/types/domain'

type InquiryReplyThreadProps = {
  replies: readonly InquiryReply[]
  status: InquiryStatus
  cancelledAt: string | null
}

/**
 * 답변이 없을 때 보여줄 안내 문구를 상태별로 고른다.
 *
 * 접수 취소·종료는 더 이상 답변을 기다릴 이유가 없으므로 "확인 중" 문구를
 * 그대로 보여주면 사용자가 계속 기다리게 된다. 취소 여부가 상태 라벨보다
 * 우선한다는 판정은 `resolveInquiryStatus` 와 같다.
 */
export function resolveNoReplyNotice(status: InquiryStatus, cancelledAt: string | null): string {
  if (isInquiryCancelled(cancelledAt)) {
    return INQUIRY_CANCELLED_NO_REPLY_NOTICE
  }

  if (status === 'closed') {
    return INQUIRY_CLOSED_NO_REPLY_NOTICE
  }

  if (status === 'in_progress') {
    return INQUIRY_IN_PROGRESS_NO_REPLY_NOTICE
  }

  return INQUIRY_NO_REPLY_NOTICE
}

/**
 * 운영자 답변 스레드(오래된 순).
 *
 * 답변이 없어도 영역 자체는 남긴다 — "언제 어디서 답을 받는지"를 알려 주는 것이
 * 이 화면의 존재 이유이기 때문이다.
 */
export function InquiryReplyThread({ replies, status, cancelledAt }: InquiryReplyThreadProps) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-ink text-label-lg font-medium">
        {INQUIRY_REPLY_HEADING}
        {replies.length > 0 ? <span className="text-ink-muted"> ({replies.length})</span> : null}
      </h3>

      {replies.length === 0 ? (
        <p className="border-line-soft text-ink-muted bg-page-sub rounded-[12px] border border-dashed px-4 py-5 text-[15px]">
          {resolveNoReplyNotice(status, cancelledAt)}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {replies.map((reply) => (
            <li
              key={reply.id}
              className="border-line-soft shadow-chip rounded-[12px] border bg-white px-4 py-4"
            >
              <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-ink text-ui font-bold">{reply.authorName}</span>
                <span className="text-ink-muted text-[15px]">
                  {formatDateLong(reply.createdAt)}
                </span>
              </p>
              {/* 답변도 평문이다. 줄바꿈만 살리고 마크업은 해석하지 않는다. */}
              <p className="text-ink mt-2 text-prose leading-[1.7] whitespace-pre-line">
                {reply.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
