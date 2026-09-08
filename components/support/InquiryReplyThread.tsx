import { INQUIRY_NO_REPLY_NOTICE, INQUIRY_REPLY_HEADING } from '@/lib/constants/support'
import { formatDateLong } from '@/lib/utils/format-date'

import type { InquiryReply } from '@/types/domain'

type InquiryReplyThreadProps = {
  replies: readonly InquiryReply[]
}

/**
 * 운영자 답변 스레드(오래된 순).
 *
 * 답변이 없어도 영역 자체는 남긴다 — "언제 어디서 답을 받는지"를 알려 주는 것이
 * 이 화면의 존재 이유이기 때문이다.
 */
export function InquiryReplyThread({ replies }: InquiryReplyThreadProps) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-ink text-[20px] font-medium">
        {INQUIRY_REPLY_HEADING}
        {replies.length > 0 ? <span className="text-ink-muted"> ({replies.length})</span> : null}
      </h3>

      {replies.length === 0 ? (
        <p className="border-line-soft text-ink-muted bg-page-sub rounded-[12px] border border-dashed px-4 py-5 text-[15px]">
          {INQUIRY_NO_REPLY_NOTICE}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {replies.map((reply) => (
            <li
              key={reply.id}
              className="border-line-soft shadow-chip rounded-[12px] border bg-white px-4 py-4"
            >
              <p className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                <span className="text-ink text-[17px] font-bold">{reply.authorName}</span>
                <span className="text-ink-muted text-[15px]">
                  {formatDateLong(reply.createdAt)}
                </span>
              </p>
              {/* 답변도 평문이다. 줄바꿈만 살리고 마크업은 해석하지 않는다. */}
              <p className="text-ink mt-2 text-[17px] leading-[1.7] whitespace-pre-line">
                {reply.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
