import { InquiryEmailThreadItem } from '@/components/inquiries/InquiryEmailThreadItem'
import { Card, CardBody, CardHeader } from '@/components/ui'
import { formatDateTime } from '@/lib/utils/format-date'

import type { InquiryReplyItem } from '@/lib/data/inquiries'

/**
 * 등록된 답변 · 이메일 스레드(오래된 순).
 *
 * 웹 문의는 사용자 화면(`components/support/InquiryReplyThread`)과 같은 순서·같은
 * 필드를 보여 준다. 운영자가 여기서 본 것과 사용자가 보는 것이 다르면 답변 사고가 난다.
 *
 * 이메일 문의는 사용자 화면이 없다 — 사용자는 자기 메일함에서 읽는다. 그래서 여기가
 * 유일한 기록이고, 받은 메일과 보낸 답신을 좌우로 갈라 대화 흐름을 그대로 남긴다.
 */
export function InquiryReplyThread({
  replies,
  isEmail,
  canWrite = false,
}: {
  replies: readonly InquiryReplyItem[]
  isEmail: boolean
  canWrite?: boolean
}) {
  if (isEmail) {
    return (
      <Card>
        <CardHeader
          title={`스레드 ${replies.length}건`}
          description="받은 메일과 보낸 답신입니다. 보낸 답신은 사용자의 메일 주소로 발송됩니다."
        />
        <CardBody className="flex flex-col gap-3">
          {replies.length === 0 ? (
            <EmptyThread message="아직 주고받은 메일이 없습니다." />
          ) : (
            replies.map((reply) => (
              <InquiryEmailThreadItem key={reply.id} reply={reply} canWrite={canWrite} />
            ))
          )}
        </CardBody>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title={`답변 ${replies.length}건`}
        description="사용자 화면에 그대로 보이는 내용입니다."
      />
      <CardBody className="flex flex-col gap-3">
        {replies.length === 0 ? (
          <EmptyThread message="아직 등록된 답변이 없습니다." />
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

function EmptyThread({ message }: { message: string }) {
  return (
    <p className="text-muted border-line rounded-panel border border-dashed px-4 py-6 text-center text-[13px]">
      {message}
    </p>
  )
}
