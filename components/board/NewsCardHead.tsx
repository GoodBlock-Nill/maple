import Image from 'next/image'

import { NEWS_CARD_HEAD_CLASS } from '@/components/board/news-card-styles'
import { Badge } from '@/components/ui/Badge'

import type { BadgeColor } from '@/lib/constants/categories'

/** 고정 글 핀 — 시안 실측 24px. */
const PIN_SIZE = 24

type NewsCardHeadProps = {
  badge: BadgeColor
  label: string
  isPinned: boolean
}

/**
 * 카드형·리스트형이 공유하는 머리줄: 좌측 말머리 뱃지, 우측 고정 핀
 * (`isPinned` 인 글만, 시안 v2 §2·§5). `NewsCard`·`NewsRow` 둘 다 이 컴포넌트를 쓴다.
 */
export function NewsCardHead({ badge, label, isPinned }: NewsCardHeadProps) {
  return (
    <div className={NEWS_CARD_HEAD_CLASS}>
      <Badge size="md" color={badge}>
        {label}
      </Badge>
      {isPinned ? (
        <Image
          src="/images/news/v2/pin.png"
          alt="고정된 글"
          width={PIN_SIZE}
          height={PIN_SIZE}
          className="shrink-0"
        />
      ) : null}
    </div>
  )
}
