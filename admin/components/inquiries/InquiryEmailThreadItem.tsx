import { InquiryResendButton } from '@/components/inquiries/InquiryResendButton'
import { Badge, type BadgeTone } from '@/components/ui'
import { cn } from '@/lib/utils/cn'
import { formatDateTime } from '@/lib/utils/format-date'

import type { InquiryReplyDeliveryStatus, InquiryReplyItem } from '@/lib/data/inquiries'

/**
 * 이메일 스레드의 한 통.
 *
 * 받은 메일은 왼쪽, 보낸 답신은 오른쪽에 붙인다. 방향을 뱃지 문구로만 구분하면
 * 긴 스레드에서 운영자가 자기가 쓴 글을 사용자 글로 읽는 사고가 난다 — 정렬과 색을
 * 함께 쓰되, 색만으로 판단하지 않도록 뱃지 문구도 남긴다.
 */
const DELIVERY: Record<InquiryReplyDeliveryStatus, { label: string; tone: BadgeTone }> = {
  queued: { label: '대기', tone: 'neutral' },
  sent: { label: '발송됨', tone: 'success-green' },
  failed: { label: '실패', tone: 'danger' },
}

export function InquiryEmailThreadItem({
  reply,
  canWrite,
}: {
  reply: InquiryReplyItem
  canWrite: boolean
}) {
  const isInbound = reply.direction === 'inbound'
  const delivery = reply.deliveryStatus === null ? null : DELIVERY[reply.deliveryStatus]

  return (
    <article
      data-testid="inquiry-reply"
      className={cn(
        'rounded-panel w-full border px-4 py-3 sm:max-w-[85%]',
        isInbound
          ? 'border-line bg-page/60 self-start'
          : 'border-accent/30 bg-accent-soft/40 self-end',
      )}
    >
      <p className="flex flex-wrap items-baseline gap-2">
        <Badge tone={isInbound ? 'neutral' : 'accent'}>
          {isInbound ? '받은 메일' : '보낸 답신'}
        </Badge>
        <span className="text-ink text-[14px] font-bold">{reply.authorName}</span>
        <span className="text-muted text-[12px]">{formatDateTime(reply.createdAt)}</span>
        {delivery !== null && <Badge tone={delivery.tone}>{delivery.label}</Badge>}
      </p>

      {/* 메일 본문도 평문이다. 줄바꿈만 살리고 마크업은 해석하지 않는다. */}
      <p className="text-ink mt-1.5 text-[14px] leading-relaxed whitespace-pre-line">
        {reply.content}
      </p>

      {/* '대기'는 아직 결과를 기다리는 상태다. 여기서 또 누르면 같은 메일이 두 통 간다. */}
      {canWrite && reply.deliveryStatus === 'failed' && (
        <div className="mt-2">
          <InquiryResendButton replyId={reply.id} />
        </div>
      )}
    </article>
  )
}
