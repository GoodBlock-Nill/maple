import Link from 'next/link'

import { BOARD_CARD_CLASS } from '@/components/board/board-styles'
import { MetaRow } from '@/components/board/MetaRow'
import { Badge } from '@/components/ui/Badge'
import { NEWS_CATEGORY_MAP } from '@/lib/constants/board'
import { cn } from '@/lib/utils/cn'

import type { NewsItem } from '@/types/domain'

type NewsRowProps = {
  item: NewsItem
}

/** "가로형" 뷰. 제목 1줄 + 우측 뱃지, 아래 메타 한 줄. */
export function NewsRow({ item }: NewsRowProps) {
  const category = NEWS_CATEGORY_MAP[item.category]

  return (
    <Link
      href={`/news/${item.id}`}
      className={cn(BOARD_CARD_CLASS, 'flex flex-col gap-1.5 px-6 py-3')}
    >
      <div className="flex items-center gap-4">
        <h3 className="text-ink line-clamp-1 min-w-0 flex-1 text-[20px] font-medium tracking-[-0.2px]">
          {item.title}
        </h3>
        <Badge size="md" color={category.badge}>
          {category.label}
        </Badge>
      </div>
      <MetaRow date={item.publishedAt} views={item.views} />
    </Link>
  )
}
