import Link from 'next/link'

import {
  BOARD_ROW_CLASS,
  BOARD_ROW_HEAD_CLASS,
  BOARD_ROW_HEAD_TITLE_SLOT_CLASS,
  BOARD_ROW_TITLE_CLASS,
} from '@/components/board/board-styles'
import { MetaRow } from '@/components/board/MetaRow'
import { Badge } from '@/components/ui/Badge'
import { NEWS_CATEGORY_MAP } from '@/lib/constants/board'

import type { NewsItem } from '@/types/domain'

type NewsRowProps = {
  item: NewsItem
}

/** "가로형" 뷰. 제목 1줄 + 우측 뱃지, 아래 메타 한 줄. */
export function NewsRow({ item }: NewsRowProps) {
  const category = NEWS_CATEGORY_MAP[item.category]

  return (
    <Link href={`/news/${item.id}`} className={BOARD_ROW_CLASS}>
      <div className={BOARD_ROW_HEAD_CLASS}>
        <h3 className={BOARD_ROW_TITLE_CLASS + ' ' + BOARD_ROW_HEAD_TITLE_SLOT_CLASS}>
          {item.title}
        </h3>
        <Badge size="md" color={category.badge} className="order-1 sm:order-2">
          {category.label}
        </Badge>
      </div>
      <MetaRow date={item.publishedAt} views={item.views} />
    </Link>
  )
}
