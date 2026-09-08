import type { ReactNode } from 'react'

/**
 * 콘텐츠 영역 최상단의 제목 블록.
 *
 * 제목만 Maplestory 서체를 쓴다(PLAN.md §5). 본문·표까지 쓰면 숫자 폭이
 * 흔들려 목록 가독성이 떨어진다.
 */
export function PageHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <header className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-ink font-maple text-[24px] leading-tight font-bold">{title}</h1>
        {description !== undefined && <p className="text-muted text-[13px]">{description}</p>}
      </div>
      {action}
    </header>
  )
}
