import { LinkMenu } from '@/components/board/LinkMenu'
import { GridIcon } from '@/components/ui/icons'
import { NEWS_VIEW_MAP, NEWS_VIEWS } from '@/lib/constants/board'

import type { NewsView } from '@/types/domain'

type ViewToggleProps = {
  active: NewsView
  hrefFor: (view: NewsView) => string
  className?: string
}

/** 뉴스 목록 보기 전환. 검색창과 같은 h45 흰 박스 + 드롭다운. */
export function ViewToggle({ active, hrefFor, className }: ViewToggleProps) {
  const current = NEWS_VIEW_MAP[active]

  return (
    <LinkMenu
      className={className}
      label="목록 보기 방식"
      triggerClassName="board-control flex items-center gap-2 px-3 text-[17px] text-ink"
      trigger={
        <>
          <GridIcon className="text-ink size-[25px] shrink-0" />
          {current.label}
        </>
      }
      items={NEWS_VIEWS.map((view) => ({
        label: view.label,
        href: hrefFor(view.value),
        isActive: view.value === active,
      }))}
    />
  )
}
