'use client'

import { useFormStatus } from 'react-dom'

import { cn } from '@/lib/utils/cn'

type InquirySubmitButtonProps = {
  /** 비로그인 상태에서는 눌러도 실패하므로 아예 잠근다. */
  disabled: boolean
  describedBy: string | undefined
  /** 수정 화면에서 갈아 끼우는 라벨. 기본값은 접수 문구다. */
  label?: string
  pendingLabel?: string
}

/** 시안 실측: 전폭 h48 pill · bg #2a2a2a · border #505967 · Inter 17px medium #edeef0. */
const SUBMIT_CLASS =
  'font-ui rounded-pill h-12 w-full border border-[#505967] bg-[#2a2a2a] text-ui font-medium ' +
  'text-[#edeef0] transition-[filter] hover:brightness-125 focus-visible:outline-2 ' +
  'focus-visible:outline-offset-2 focus-visible:outline-focus disabled:pointer-events-none ' +
  'disabled:opacity-60'

/**
 * 문의 등록 버튼.
 *
 * `useFormStatus` 는 **폼의 자식 컴포넌트에서만** 상태를 읽을 수 있어 분리한다.
 * 덕분에 폼 전체를 상태 컴포넌트로 만들지 않고도 이중 제출을 막는다.
 */
export function InquirySubmitButton({
  disabled,
  describedBy,
  label = '문의 등록하기',
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
