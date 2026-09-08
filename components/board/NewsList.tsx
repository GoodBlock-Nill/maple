import { BoardEmpty } from '@/components/board/BoardEmpty'
import { NewsRow } from '@/components/board/NewsRow'

import type { NewsItem } from '@/types/domain'

type NewsListProps = {
  items: readonly NewsItem[]
}

export function NewsList({ items }: NewsListProps) {
  if (items.length === 0) {
    return <BoardEmpty />
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <NewsRow key={item.id} item={item} />
      ))}
    </div>
  )
}
