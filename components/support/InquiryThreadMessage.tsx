import { InquiryAttachmentList } from '@/components/support/InquiryAttachmentList'
import { ChatDotsIcon, UserIcon } from '@/components/support/support-icons'
import { INQUIRY_USER_REPLY_LABEL } from '@/lib/constants/inquiry-thread'
import { cn } from '@/lib/utils/cn'
import { formatDateLong } from '@/lib/utils/format-date'

import type { InquiryReply } from '@/types/domain'

/** 답변 상자는 길어도 화면을 통째로 밀어내지 않는다(시안 주석: 287 을 넘으면 내부 스크롤). */
const REPLY_BODY_MAX_HEIGHT = 287

/** 운영자 답변 — 옅은 파란 상자(시안 v2 pc-3). */
const OPERATOR_BOX_CLASS = 'bg-[#f3f6fe]'

/**
 * 내 답장 — 흰 상자에 테두리.
 *
 * 배경을 주지 않고 선으로만 구분하는 이유는 대화가 길어졌을 때 "색이 있는 쪽"이
 * 운영자 답변 하나로 남아야 눈이 답을 먼저 찾기 때문이다.
 */
const MEMBER_BOX_CLASS = 'border border-[#cdd3db] bg-white'

type InquiryThreadMessageProps = {
  reply: InquiryReply
}

/**
 * 스레드의 한 마디(운영자 답변 · 회원 답장).
 *
 * 상자 톤은 **방향**이 정하고, 머리줄 이름은 작성자가 정한다. 내 답장이면 "내 답변"
 * 으로 바꿔 적는다 — 자기 닉네임을 자기 화면에서 다시 읽을 이유가 없고, 이메일로
 * 들어온 회신(작성자 없음)은 보낸 이름을 그대로 남겨야 어느 경로로 들어왔는지 안다.
 */
export function InquiryThreadMessage({ reply }: InquiryThreadMessageProps) {
  const isMember = reply.direction === 'inbound'
  const author = reply.isMine ? INQUIRY_USER_REPLY_LABEL : reply.authorName

  return (
    <article
      className={cn(
        'rounded-[16px] px-4 py-3 lg:p-6',
        isMember ? MEMBER_BOX_CLASS : OPERATOR_BOX_CLASS,
      )}
    >
      <p className="flex items-center gap-2 lg:gap-3">
        {isMember ? (
          <UserIcon className="size-6 shrink-0 text-[#727272]" />
        ) : (
          <ChatDotsIcon className="size-6 shrink-0 text-[#727272]" />
        )}
        <span className="text-ink text-[14px] leading-[20px] font-medium lg:text-[16px] lg:leading-[22px]">
          {author}
        </span>
        <span aria-hidden className="h-3 w-px shrink-0 bg-[#d9d9d9]" />
        <span className="text-[13px] leading-[18px] font-medium text-[#727272] lg:text-[15px] lg:leading-[22px]">
          {formatDateLong(reply.createdAt)}
        </span>
      </p>

      {/* 답변·답장 모두 평문이다. 줄바꿈만 살리고 마크업은 해석하지 않는다.
          들여쓰기는 머리줄의 작성자 이름이 시작하는 선(아이콘 24 + gap 4)이다. */}
      <p
        style={{ maxHeight: `${REPLY_BODY_MAX_HEIGHT}px` }}
        className="mt-4 overflow-y-auto pl-7 text-[14px] leading-[20px] font-medium break-words whitespace-pre-line text-[#727272] lg:mt-5 lg:text-[16px] lg:leading-[22px]"
      >
        {reply.content}
      </p>

      {/* 첨부는 그 말 아래에 붙는다 — 어느 쪽이 보낸 자료인지 상자가 말해 준다. */}
      <div className="pl-7">
        <InquiryAttachmentList attachments={reply.attachments} />
      </div>
    </article>
  )
}
