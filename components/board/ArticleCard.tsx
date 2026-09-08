import { MetaRow } from '@/components/board/MetaRow'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

import type { BadgeColor } from '@/lib/constants/categories'
import type { ReactNode } from 'react'

type ArticleCardProps = {
  badge: { label: string; color: BadgeColor }
  title: string
  date: string
  views: number
  likes?: number
  /** 제목 우측(데스크톱) 슬롯 — 작성자 표시 등. */
  aside?: ReactNode
  /** 메타 줄 옆에 붙는 부가 표시 — "수정됨" 등. */
  note?: ReactNode
  /** 헤더 위(카드 최상단)에 깔리는 시각 요소 — 뉴스 말머리 배너 등. */
  banner?: ReactNode
  /**
   * 메타 줄 오른쪽 끝에 겹쳐 두는 액션 — 공유 버튼 등.
   * 흐름에서 빠져 있으므로(absolute) 날짜·조회수의 위치를 밀지 않는다.
   */
  metaAside?: ReactNode
  children: ReactNode
  className?: string
}

/** 상세 페이지의 단일 흰 카드. 목록 카드와 같은 표면을 쓰되 hover 효과는 없다. */
export function ArticleCard({
  badge,
  title,
  date,
  views,
  likes,
  aside,
  note,
  banner,
  metaAside,
  children,
  className,
}: ArticleCardProps) {
  return (
    <article
      className={cn(
        'rounded-panel border-line-soft bg-surface shadow-chip border p-6 sm:p-10',
        className,
      )}
    >
      {banner === undefined ? null : <div className="mb-6">{banner}</div>}

      <header className="border-line flex flex-col gap-4 border-b pb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Badge size="md" color={badge.color}>
            {badge.label}
          </Badge>
          {aside}
        </div>
        <h2 className="text-ink text-[clamp(22px,3vw,32px)] leading-[1.35] font-semibold tracking-[-0.5px]">
          {title}
        </h2>
        <div className="relative flex flex-wrap items-center gap-x-3 gap-y-1">
          <MetaRow date={date} views={views} likes={likes} />
          {note}
          {metaAside === undefined ? null : (
            <div className="absolute top-1/2 right-0 -translate-y-1/2">{metaAside}</div>
          )}
        </div>
      </header>

      <div className="pt-8">{children}</div>
    </article>
  )
}
