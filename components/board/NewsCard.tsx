import Link from 'next/link'

import { MetaRow } from '@/components/board/MetaRow'
import { NewsCardHead } from '@/components/board/NewsCardHead'
import {
  NEWS_CARD_BODY_CLASS,
  NEWS_CARD_CLASS,
  NEWS_CARD_SUMMARY_CLASS,
  NEWS_CARD_TITLE_CLASS,
} from '@/components/board/news-card-styles'
import { NEWS_CATEGORY_MAP } from '@/lib/constants/board'

import type { NewsItem } from '@/types/domain'

type NewsCardProps = {
  item: NewsItem
}

/**
 * "카드형" 뷰의 카드 1장(시안 v2 §2). 위에서부터 [뱃지 · 핀] / [제목 · 요약] / [메타].
 *
 * 요약이 비어 있으면 빈 줄을 남기지 않고 통째로 생략한다 — 카드 높이는 grid 행에서
 * stretch 되므로 이웃 카드와 아래 끝이 어긋나지 않는다.
 */
export function NewsCard({ item }: NewsCardProps) {
  const category = NEWS_CATEGORY_MAP[item.category]

  return (
    <Link href={`/news/${item.id}`} className={NEWS_CARD_CLASS}>
      <NewsCardHead badge={category.badge} label={category.label} isPinned={item.isPinned} />

      <div className={NEWS_CARD_BODY_CLASS}>
        <h3 className={NEWS_CARD_TITLE_CLASS}>{item.title}</h3>
        {item.summary === '' ? null : <p className={NEWS_CARD_SUMMARY_CLASS}>{item.summary}</p>}
      </div>

      <MetaRow date={item.publishedAt} views={item.views} className="mt-auto" />
    </Link>
  )
}
