import Link from 'next/link'

import { BOARD_CARD_CLASS, BOARD_TITLE_CLASS } from '@/components/board/board-styles'
import { MetaRow } from '@/components/board/MetaRow'
import { Badge } from '@/components/ui/Badge'
import { NEWS_CATEGORY_MAP } from '@/lib/constants/board'
import { cn } from '@/lib/utils/cn'

import type { NewsItem } from '@/types/domain'

type NewsCardProps = {
  item: NewsItem
}

/** 타일 뷰(기본) 카드. 2열 그리드 안에서 높이 228px 로 정렬된다. */
export function NewsCard({ item }: NewsCardProps) {
  const category = NEWS_CATEGORY_MAP[item.category]

  return (
    <Link href={`/news/${item.id}`} className={cn(BOARD_CARD_CLASS, 'flex flex-col gap-6 p-6')}>
      <Badge size="md" color={category.badge} className="self-start">
        {category.label}
      </Badge>

      <div className="flex flex-col gap-3">
        <h3 className={BOARD_TITLE_CLASS}>{item.title}</h3>
        <p className="text-ink-muted line-clamp-2 min-h-[50px] text-[17px] leading-[25px]">
          {item.summary}
        </p>
      </div>

      <MetaRow date={item.publishedAt} views={item.views} />
    </Link>
  )
}
