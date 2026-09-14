import { InquiryReplyThread } from '@/components/support/InquiryReplyThread'
import { InquiryUserReplyForm } from '@/components/support/InquiryUserReplyForm'
import { canUserReply, userReplyBlockedNotice } from '@/lib/utils/inquiry-thread'

import type { InquiryReply, InquiryStatus } from '@/types/domain'

type InquiryReplySectionProps = {
  inquiryId: string
  replies: readonly InquiryReply[]
  status: InquiryStatus
  cancelledAt: string | null
}

/**
 * 대화 영역 — 스레드 + 답장 폼(또는 답장할 수 없는 이유).
 *
 * 판정을 화면 조각이 아니라 여기서 한 번만 하는 이유는 폼과 안내가 **같은 하나의
 * 결정**이기 때문이다. 두 곳에서 각자 물으면 "폼도 없고 안내도 없는" 상태가 조용히
 * 생긴다. 규칙 자체는 순수 함수(`canUserReply`)가 들고 있고, 서버 액션과 RPC 가
 * 같은 규칙을 다시 본다 — 이 화면은 마지막 방어선이 아니다.
 */
export function InquiryReplySection({
  inquiryId,
  replies,
  status,
  cancelledAt,
}: InquiryReplySectionProps) {
  const permission = canUserReply({ status, cancelledAt, replies })
  const notice = permission.reason === null ? null : userReplyBlockedNotice(permission.reason)

  return (
    <div className="flex flex-col gap-5">
      <InquiryReplyThread replies={replies} status={status} cancelledAt={cancelledAt} />

      {permission.allowed ? <InquiryUserReplyForm inquiryId={inquiryId} /> : null}

      {/* 접수 취소는 문구가 없다 — 스레드 자리가 이미 "접수가 취소된 문의입니다"다. */}
      {notice === null ? null : (
        <p className="text-[14px] leading-[20px] font-medium text-[#727272] lg:text-[15px] lg:leading-[22px]">
          {notice}
        </p>
      )}
    </div>
  )
}
