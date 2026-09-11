import Link from 'next/link'

import { MetaRow } from '@/components/board/MetaRow'
import { NewsCardHead } from '@/components/board/NewsCardHead'
import { NEWS_CARD_CLASS, NEWS_CARD_TITLE_CLASS } from '@/components/board/news-card-styles'
import { NEWS_CATEGORY_MAP } from '@/lib/constants/board'

import type { NewsItem } from '@/types/domain'

type NewsRowProps = {
  item: NewsItem
}

/**
 * "리스트형" 뷰의 행 1개(시안 v2 §5). 카드형과 같은 표면·패딩·세로 gap 을 그대로
 * 쓰고, 요약 줄만 뺀다 — 위에서부터 [뱃지 · 핀] / [제목 한 줄] / [메타].
 */
export function NewsRow({ item }: NewsRowProps) {
  const category = NEWS_CATEGORY_MAP[item.category]

  return (
    <Link href={`/news/${item.id}`} className={NEWS_CARD_CLASS}>
      <NewsCardHead badge={category.badge} label={category.label} isPinned={item.isPinned} />

      <h3 className={NEWS_CARD_TITLE_CLASS}>{item.title}</h3>

      <MetaRow date={item.publishedAt} views={item.views} className="mt-auto" />
    </Link>
  )
}
