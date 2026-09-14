import { InquiryThreadMessage } from '@/components/support/InquiryThreadMessage'
import { ChatDotsIcon } from '@/components/support/support-icons'
import {
  INQUIRY_CANCELLED_NO_REPLY_NOTICE,
  INQUIRY_CLOSED_NO_REPLY_NOTICE,
  INQUIRY_IN_PROGRESS_NO_REPLY_NOTICE,
  INQUIRY_NO_REPLY_NOTICE,
  INQUIRY_REPLY_HEADING,
} from '@/lib/constants/support'
import { isInquiryCancelled } from '@/lib/utils/inquiry-permissions'

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
 * 문의 대화 스레드(오래된 순).
 *
 * 운영자 답변과 회원 답장을 **한 줄기로** 섞어 그린다(2026-09-14) — 답장이 따로
 * 모여 있으면 "무엇에 대한 답인지"를 사용자가 시각으로 맞춰 봐야 한다. 상자의
 * 모양은 각 메시지가 정하고(`InquiryThreadMessage`), 여기서는 순서와 빈 상태만 맡는다.
 *
 * 답변이 없어도 영역 자체는 남긴다 — "언제 어디서 답을 받는지"를 알려 주는 것이
 * 이 화면의 존재 이유이기 때문이다. 빈 상태는 파선 상자다(시안 v2 pc-2).
 */
export function InquiryReplyThread({ replies, status, cancelledAt }: InquiryReplyThreadProps) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-ink text-[14px] leading-[20px] font-semibold lg:text-[16px] lg:leading-[22px]">
        {INQUIRY_REPLY_HEADING}
      </h3>

      {replies.length === 0 ? (
        <p className="bg-page-sub flex items-center gap-1 rounded-[16px] border border-dashed border-[#d5d9df] px-4 py-3 text-[14px] leading-[20px] font-medium text-[#727272] lg:min-h-[72px] lg:px-6 lg:text-[16px] lg:leading-[22px]">
          <ChatDotsIcon className="size-5 shrink-0 text-[#727272] lg:size-6" />
          {resolveNoReplyNotice(status, cancelledAt)}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {replies.map((reply) => (
            <li key={reply.id}>
              <InquiryThreadMessage reply={reply} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
