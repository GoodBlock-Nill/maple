import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

/**
 * 회원 카드의 라벨 + 값 한 칸.
 *
 * `<dl>` 이 아니라 div/p 로 그린다 — 카드 본문이 `<div>` 라 dt/dd 를 직접 넣으면
 * 문서 구조가 깨진다(dl 자식이 아닌 dt 는 유효하지 않다).
 *
 * 프로필 카드와 생애주기 카드가 같은 컴포넌트를 쓴다. 두 카드가 나란히 놓이므로
 * 각자 비슷한 마크업을 들고 있으면 여백·글자 크기가 조금씩 어긋나 보인다.
 */
export function MemberField({
  label,
  value,
  mono = false,
  tone = 'default',
  className,
}: {
  label: string
  value: ReactNode
  mono?: boolean
  tone?: 'default' | 'danger'
  className?: string
}) {
  return (
    <div className={className}>
      <p className="text-muted text-[12px] font-semibold">{label}</p>
      <div
        className={cn(
          'text-[13px] break-all',
          mono && 'font-mono',
          tone === 'danger' ? 'text-danger font-semibold' : 'text-ink',
        )}
      >
        {value}
      </div>
    </div>
  )
}
