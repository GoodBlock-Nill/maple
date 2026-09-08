'use client'

import { useFormStatus } from 'react-dom'

import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

type SubmitButtonProps = {
  children: string
  /** 제출 중에 보여 줄 문구. 없으면 라벨을 그대로 두고 비활성만 한다. */
  pendingLabel?: string
  className?: string
}

/**
 * 폼 제출 버튼.
 *
 * `useFormStatus` 는 **폼의 자식 컴포넌트에서만** 상태를 읽을 수 있어서
 * 별도 컴포넌트로 분리한다. 이 덕분에 폼 전체를 클라이언트 상태로 만들지 않고도
 * 이중 제출을 막는다.
 */
export function SubmitButton({ children, pendingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus()

  return (
    <Button
      type="submit"
      size="lg"
      disabled={pending}
      aria-busy={pending}
      className={cn('w-full rounded-[10px] text-ui', className)}
    >
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  )
}
