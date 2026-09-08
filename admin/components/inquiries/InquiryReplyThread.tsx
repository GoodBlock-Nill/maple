import { Card, CardBody, CardHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/utils/format-date'

import type { InquiryReplyItem } from '@/lib/data/inquiries'

/**
 * 등록된 답변(오래된 순).
 *
 * 사용자 화면(`components/support/InquiryReplyThread`)과 같은 순서·같은 필드를
 * 보여 준다. 운영자가 여기서 본 것과 사용자가 보는 것이 다르면 답변 사고가 난다.
 */
export function InquiryReplyThread({ replies }: { replies: readonly InquiryReplyItem[] }) {
  return (
    <Card>
      <CardHeader
        title={`답변 ${replies.length}건`}
        description="사용자 화면에 그대로 보이는 내용입니다."
      />
      <CardBody className="flex flex-col gap-3">
        {replies.length === 0 ? (
          <p className="text-muted border-line rounded-panel border border-dashed px-4 py-6 text-center text-[13px]">
            아직 등록된 답변이 없습니다.
          </p>
        ) : (
          replies.map((reply) => (
            <article
              key={reply.id}
              className="border-line rounded-panel bg-page/60 border px-4 py-3"
              data-testid="inquiry-reply"
            >
              <p className="flex flex-wrap items-baseline gap-2">
                <span className="text-ink text-[14px] font-bold">{reply.authorName}</span>
                <span className="text-muted text-[12px]">{formatDateTime(reply.createdAt)}</span>
              </p>
              {/* 답변도 평문이다. 줄바꿈만 살리고 마크업은 해석하지 않는다. */}
              <p className="text-ink mt-1.5 text-[14px] leading-relaxed whitespace-pre-line">
                {reply.content}
              </p>
            </article>
          ))
        )}
      </CardBody>
    </Card>
  )
}
