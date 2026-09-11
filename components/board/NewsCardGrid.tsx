import { BoardEmpty } from '@/components/board/BoardEmpty'
import { NewsCard } from '@/components/board/NewsCard'
import { NEWS_CARD_GRID_CLASS } from '@/components/board/news-card-styles'

import type { NewsItem } from '@/types/domain'

type NewsCardGridProps = {
  items: readonly NewsItem[]
}

/** "카드형" 뷰 — 2열 grid(시안 v2 §2). 빈 목록은 행 목록과 같은 `BoardEmpty`. */
export function NewsCardGrid({ items }: NewsCardGridProps) {
  if (items.length === 0) {
    return <BoardEmpty />
  }

  return (
    <div className={NEWS_CARD_GRID_CLASS}>
      {items.map((item) => (
        <NewsCard key={item.id} item={item} />
      ))}
    </div>
  )
}
