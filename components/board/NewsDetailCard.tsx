import Image from 'next/image'
import Link from 'next/link'

import { BOARD_CARD_CLASS, BOARD_TITLE_CLASS } from '@/components/board/board-styles'
import { MetaRow } from '@/components/board/MetaRow'
import { Badge } from '@/components/ui/Badge'
import { NEWS_CATEGORY_MAP } from '@/lib/constants/board'
import { cn } from '@/lib/utils/cn'

import type { NewsItem } from '@/types/domain'

type NewsDetailCardProps = {
  item: NewsItem
}

/** "자세히" 뷰. 좌측 정방형 썸네일(없으면 회색 플레이스홀더) + 우측 본문. */
export function NewsDetailCard({ item }: NewsDetailCardProps) {
  const category = NEWS_CATEGORY_MAP[item.category]

  return (
    <Link href={`/news/${item.id}`} className={cn(BOARD_CARD_CLASS, 'flex gap-6 p-6')}>
      <div className="bg-sheet border-line size-[140px] shrink-0 overflow-hidden rounded-xl border">
        {item.thumbnail === undefined ? null : (
          <Image
            src={item.thumbnail}
            alt=""
            width={140}
            height={140}
            className="size-full object-cover"
          />
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-start justify-between gap-4">
          <h3 className={cn(BOARD_TITLE_CLASS, 'min-w-0 flex-1')}>{item.title}</h3>
          <Badge size="md" color={category.badge}>
            {category.label}
          </Badge>
        </div>
        <p className="text-ink-muted line-clamp-2 min-h-[50px] text-[17px] leading-[25px]">
          {item.summary}
        </p>
        <MetaRow date={item.publishedAt} views={item.views} className="mt-auto" />
      </div>
    </Link>
  )
}
