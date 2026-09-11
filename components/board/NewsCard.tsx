import Image from 'next/image'
import Link from 'next/link'

import { MetaRow } from '@/components/board/MetaRow'
import {
  NEWS_CARD_BODY_CLASS,
  NEWS_CARD_CLASS,
  NEWS_CARD_HEAD_CLASS,
  NEWS_CARD_SUMMARY_CLASS,
  NEWS_CARD_TITLE_CLASS,
} from '@/components/board/news-card-styles'
import { Badge } from '@/components/ui/Badge'
import { NEWS_CATEGORY_MAP } from '@/lib/constants/board'

import type { NewsItem } from '@/types/domain'

/** 고정 글 핀 — 시안 실측 24px. */
const PIN_SIZE = 24

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
      <div className={NEWS_CARD_HEAD_CLASS}>
        <Badge size="md" color={category.badge}>
          {category.label}
        </Badge>
        {item.isPinned ? (
          <Image
            src="/images/news/v2/pin.png"
            alt="고정된 글"
            width={PIN_SIZE}
            height={PIN_SIZE}
            className="shrink-0"
          />
        ) : null}
      </div>

      <div className={NEWS_CARD_BODY_CLASS}>
        <h3 className={NEWS_CARD_TITLE_CLASS}>{item.title}</h3>
        {item.summary === '' ? null : <p className={NEWS_CARD_SUMMARY_CLASS}>{item.summary}</p>}
      </div>

      <MetaRow date={item.publishedAt} views={item.views} className="mt-auto" />
    </Link>
  )
}
