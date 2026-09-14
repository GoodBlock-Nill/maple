import { InquiryAttachments } from '@/components/inquiries/InquiryAttachments'
import { InquiryEmailThreadItem } from '@/components/inquiries/InquiryEmailThreadItem'
import { Badge, Card, CardBody, CardHeader } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format-date'

import type { InquiryReplyItem } from '@/lib/data/inquiries'

/**
 * 등록된 답변 · 이메일 스레드(오래된 순).
 *
 * 웹 문의는 사용자 화면(`components/support/InquiryReplyThread`)과 같은 순서·같은
 * 필드를 보여 준다. 운영자가 여기서 본 것과 사용자가 보는 것이 다르면 답변 사고가 난다.
 *
 * 웹 문의의 스레드에는 **회원 답장**이 섞인다(20260914000400). 처리 중인 문의에
 * 회원이 남긴 답장이라 운영자 답변과 한눈에 갈려야 한다 — 배경과 라벨을 함께 바꾼다
 * (색만으로 가르면 흑백 출력·색각 이상에서 구분이 사라진다).
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

  /* 제목의 숫자는 **운영자 답변 수**다. 회원 답장까지 함께 세면 "몇 번 답했는가"를
     읽을 수 없다. 회원 답장은 설명 줄이 따로 알린다. */
  const memberReplyCount = replies.filter((reply) => reply.isMemberReply).length

  return (
    <Card>
      <CardHeader
        title={`답변 ${replies.length - memberReplyCount}건`}
        description={
          memberReplyCount === 0
            ? '사용자 화면에 그대로 보이는 내용입니다.'
            : `회원 답장 ${memberReplyCount}건이 함께 있습니다. 사용자 화면에 그대로 보이는 내용입니다.`
        }
      />
      <CardBody className="flex flex-col gap-3">
        {replies.length === 0 ? (
          <EmptyThread message="아직 등록된 답변이 없습니다." />
        ) : (
          replies.map((reply) => <ThreadItem key={reply.id} reply={reply} />)
        )}
      </CardBody>
    </Card>
  )
}

/**
 * 웹 문의 스레드의 한 줄.
 *
 * 회원 답장은 한 단계 안쪽으로 들여(왼쪽 굵은 선) 대화의 방향을 보여 준다. 운영자
 * 답변은 기존 모양 그대로다 — 익숙한 화면이 바뀌면 운영자가 매번 다시 읽는다.
 */
function ThreadItem({ reply }: { reply: InquiryReplyItem }) {
  return (
    <article
      className={cn(
        'rounded-panel border px-4 py-3',
        reply.isMemberReply
          ? 'border-accent/25 bg-accent-soft/40 border-l-[3px]'
          : 'border-line bg-page/60',
      )}
      data-testid={reply.isMemberReply ? 'inquiry-member-reply' : 'inquiry-reply'}
    >
      <p className="flex flex-wrap items-baseline gap-2">
        {reply.isMemberReply && <Badge tone="accent">회원 답장</Badge>}
        <span className="text-ink text-[14px] font-bold">{reply.authorName}</span>
        <span className="text-muted text-[12px]">{formatDateTime(reply.createdAt)}</span>
      </p>
      {/* 답변도 평문이다. 줄바꿈만 살리고 마크업은 해석하지 않는다. */}
      <p className="text-ink mt-1.5 text-[14px] leading-relaxed whitespace-pre-line">
        {reply.content}
      </p>
      {/* 첨부가 없는 답변이 대부분이다 — 없을 때 '첨부파일이 없습니다'를 줄마다
          적으면 스레드가 그 문장으로 채워진다. */}
      {reply.attachments.length > 0 && (
        <div className="mt-3">
          <InquiryAttachments attachments={reply.attachments} />
        </div>
      )}
    </article>
  )
}

function EmptyThread({ message }: { message: string }) {
  return (
    <p className="text-muted border-line rounded-panel border border-dashed px-4 py-6 text-center text-[13px]">
      {message}
    </p>
  )
}
