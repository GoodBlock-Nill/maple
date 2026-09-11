'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useId, useState } from 'react'

import { DialogShell } from '@/components/ui/DialogShell'
import {
  INQUIRY_SUBMITTED_CONFIRM_LABEL,
  INQUIRY_SUBMITTED_DESCRIPTION,
  INQUIRY_SUBMITTED_TITLE,
  MY_INQUIRIES_LINK_LABEL,
  MY_INQUIRIES_PATH,
  inquirySubmittedReceiptNotice,
} from '@/lib/constants/support'
import { formatInquiryNo } from '@/lib/utils/inquiry-no'

type InquirySubmittedDialogProps = {
  /** 파라미터를 뗀 상세 주소. 닫을 때 이 주소로 갈아 끼운다. */
  detailPath: string
  /** 방금 받은 접수번호. 사용자가 적어 둘 수 있도록 모달에서 한 번 더 보여 준다. */
  inquiryNo: number
}

const PRIMARY_CLASS =
  'cta-dark rounded-pill focus-visible:outline-focus inline-flex h-11 items-center justify-center ' +
  'px-6 text-[15px] font-semibold transition-[filter] hover:brightness-125 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2'

const OUTLINE_CLASS =
  'cta-light rounded-pill text-ink focus-visible:outline-focus inline-flex h-11 items-center ' +
  'justify-center px-5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2'

/**
 * 접수 완료 모달.
 *
 * 노출 여부는 서버가 정하고(`?submitted=1`), 닫는 순간 주소에서 그 파라미터를 뗀다.
 * 새로고침·공유 링크에서 다시 뜨면 "또 접수됐나?" 하고 오해하기 때문이다.
 * `history.replaceState` 가 아니라 `router.replace` 를 쓰는 이유는 서버가 아는
 * 주소까지 함께 갈아 끼워야 뒤로 가기에서도 되살아나지 않기 때문이다.
 */
export function InquirySubmittedDialog({ detailPath, inquiryNo }: InquirySubmittedDialogProps) {
  const router = useRouter()
  const [open, setOpen] = useState(true)
  const titleId = useId()
  const descriptionId = useId()

  const close = () => {
    setOpen(false)
    router.replace(detailPath, { scroll: false })
  }

  return (
    <DialogShell
      open={open}
      onClose={close}
      labelledBy={titleId}
      describedBy={descriptionId}
      className="max-w-[420px]"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <SuccessMark />

        <h2 id={titleId} className="text-ink text-label-lg font-semibold">
          {INQUIRY_SUBMITTED_TITLE}
        </h2>

        <p
          className="text-ink text-[17px] font-semibold tabular-nums"
          data-testid="inquiry-receipt"
        >
          {inquirySubmittedReceiptNotice(formatInquiryNo(inquiryNo))}
        </p>

        <p id={descriptionId} className="text-ink-muted text-[15px] leading-[1.6]">
          {INQUIRY_SUBMITTED_DESCRIPTION}
        </p>
      </div>

      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
        <Link href={MY_INQUIRIES_PATH} className={OUTLINE_CLASS}>
          {MY_INQUIRIES_LINK_LABEL}
        </Link>
        <button type="button" onClick={close} className={PRIMARY_CLASS}>
          {INQUIRY_SUBMITTED_CONFIRM_LABEL}
        </button>
      </div>
    </DialogShell>
  )
}

/** 체크 표시. 자산을 늘리지 않도록 인라인 SVG 로 그리고 색은 상태 토큰을 쓴다. */
function SuccessMark() {
  return (
    <span
      aria-hidden
      className="bg-tag-green-bg text-tag-green flex size-14 items-center justify-center rounded-full"
    >
      <svg
        width="28"
        height="28"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12.5 9.5 18 20 6.5" />
      </svg>
    </span>
  )
}
