import { BoardEmpty } from '@/components/board/BoardEmpty'
import { NEWS_ROW_LIST_CLASS } from '@/components/board/news-card-styles'
import { NewsRow } from '@/components/board/NewsRow'

import type { NewsItem } from '@/types/domain'

type NewsListProps = {
  items: readonly NewsItem[]
}

/** "리스트형" 뷰 — 1열 목록, 행 사이 gap 16(시안 v2 §5). 빈 목록은 카드형과 같은 `BoardEmpty`. */
export function NewsList({ items }: NewsListProps) {
  if (items.length === 0) {
    return <BoardEmpty />
  }

  return (
    <div className={NEWS_ROW_LIST_CLASS}>
      {items.map((item) => (
        <NewsRow key={item.id} item={item} />
      ))}
    </div>
  )
}
