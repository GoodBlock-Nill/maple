'use client'

import { useFormStatus } from 'react-dom'

import { cn } from '@/lib/utils/cn'

type InquirySubmitButtonProps = {
  /** 비로그인 상태에서는 눌러도 실패하므로 아예 잠근다. */
  disabled: boolean
  describedBy: string | undefined
  /**
   * 버튼 문구. 접수는 창구의 제출 문구(`INQUIRY_KIND_MAP[kind].submitLabel`),
   * 수정은 "수정 완료"다 — 기본값을 두지 않는 이유는 제보 창구에서 "문의"라는
   * 말이 새어 나오는 것을 타입으로 막기 위해서다.
   */
  label: string
  pendingLabel?: string
}

/** 시안 v2 실측: 142×48(모바일) · 183×54(PC) pill · bg #2a2a2a · Inter semibold white. */
const SUBMIT_CLASS =
  'font-ui rounded-pill inline-flex h-12 w-[142px] items-center justify-center bg-[#2a2a2a] ' +
  'text-[16px] leading-[24px] font-semibold text-white transition-[filter] hover:brightness-125 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:pointer-events-none disabled:opacity-60 lg:h-[54px] lg:w-[183px] lg:text-[18px] ' +
  'lg:leading-[26px]'

/**
 * 문의 등록 버튼.
 *
 * `useFormStatus` 는 **폼의 자식 컴포넌트에서만** 상태를 읽을 수 있어 분리한다.
 * 덕분에 폼 전체를 상태 컴포넌트로 만들지 않고도 이중 제출을 막는다.
 */
export function InquirySubmitButton({
  disabled,
  describedBy,
  label,
  pendingLabel = '접수 중…',
}: InquirySubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      aria-describedby={describedBy}
      className={cn(SUBMIT_CLASS)}
    >
      {pending ? pendingLabel : label}
    </button>
  )
}
