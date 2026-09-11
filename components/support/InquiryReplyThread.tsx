import { ChatDotsIcon } from '@/components/support/support-icons'
import {
  INQUIRY_CANCELLED_NO_REPLY_NOTICE,
  INQUIRY_CLOSED_NO_REPLY_NOTICE,
  INQUIRY_IN_PROGRESS_NO_REPLY_NOTICE,
  INQUIRY_NO_REPLY_NOTICE,
  INQUIRY_REPLY_HEADING,
} from '@/lib/constants/support'
import { formatDateLong } from '@/lib/utils/format-date'
import { isInquiryCancelled } from '@/lib/utils/inquiry-permissions'

import type { InquiryReply, InquiryStatus } from '@/types/domain'

type InquiryReplyThreadProps = {
  replies: readonly InquiryReply[]
  status: InquiryStatus
  cancelledAt: string | null
}

/** 답변 상자는 길어도 화면을 통째로 밀어내지 않는다(시안 주석: 287 을 넘으면 내부 스크롤). */
const REPLY_BODY_MAX_HEIGHT = 287

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
 * 이 화면의 존재 이유이기 때문이다. 빈 상태는 파선 상자, 답변은 옅은 파란 상자로
 * 구분한다(시안 v2 pc-2/pc-3).
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
            <li key={reply.id} className="rounded-[16px] bg-[#f3f6fe] px-4 py-3 lg:p-6">
              <p className="flex items-center gap-2 lg:gap-3">
                <ChatDotsIcon className="size-6 shrink-0 text-[#727272]" />
                <span className="text-ink text-[14px] leading-[20px] font-medium lg:text-[16px] lg:leading-[22px]">
                  {reply.authorName}
                </span>
                <span aria-hidden className="h-3 w-px shrink-0 bg-[#d9d9d9]" />
                <span className="text-[13px] leading-[18px] font-medium text-[#727272] lg:text-[15px] lg:leading-[22px]">
                  {formatDateLong(reply.createdAt)}
                </span>
              </p>
              {/* 답변도 평문이다. 줄바꿈만 살리고 마크업은 해석하지 않는다.
                  들여쓰기는 머리줄의 작성자 이름이 시작하는 선(아이콘 24 + gap 4)이다. */}
              <p
                style={{ maxHeight: `${REPLY_BODY_MAX_HEIGHT}px` }}
                className="mt-4 overflow-y-auto pl-7 text-[14px] leading-[20px] font-medium break-words whitespace-pre-line text-[#727272] lg:mt-5 lg:text-[16px] lg:leading-[22px]"
              >
                {reply.content}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
