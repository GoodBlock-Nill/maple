import { BoardEmpty } from '@/components/board/BoardEmpty'
import { NewsCard } from '@/components/board/NewsCard'
import { NewsDetailCard } from '@/components/board/NewsDetailCard'
import { NewsRow } from '@/components/board/NewsRow'

import type { NewsItem, NewsView } from '@/types/domain'
import type { ReactNode } from 'react'

/** Tailwind v4 는 동적 클래스 보간을 스캔하지 못하므로 완전한 문자열로 둔다. */
const VIEW_LIST_CLASS: Record<NewsView, string> = {
  tile: 'grid grid-cols-1 gap-4 md:grid-cols-2',
  detail: 'flex flex-col gap-4',
  row: 'flex flex-col gap-3',
}

const VIEW_ITEM: Record<NewsView, (item: NewsItem) => ReactNode> = {
  tile: (item) => <NewsCard key={item.id} item={item} />,
  detail: (item) => <NewsDetailCard key={item.id} item={item} />,
  row: (item) => <NewsRow key={item.id} item={item} />,
}

type NewsListProps = {
  items: readonly NewsItem[]
  view: NewsView
}

export function NewsList({ items, view }: NewsListProps) {
  if (items.length === 0) {
    return <BoardEmpty />
  }

  return <div className={VIEW_LIST_CLASS[view]}>{items.map(VIEW_ITEM[view])}</div>
}
