import type { ReactNode } from 'react'

/** 목록·상세가 비었을 때의 안내. 표 안에서는 Table 의 emptyMessage 를 쓴다. */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <p className="text-ink text-[15px] font-bold">{title}</p>
      {description !== undefined && <p className="text-muted text-[13px]">{description}</p>}
      {action !== undefined && <div className="mt-2">{action}</div>}
    </div>
  )
}
