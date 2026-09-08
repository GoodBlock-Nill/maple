import Link from 'next/link'

import { Badge, type BadgeTone } from '@/components/ui/Badge'
import { formatRelativeDay } from '@/lib/utils/format-date'

import type { ActivityItem, ActivityKind } from '@/lib/data/dashboard'

const KIND_LABEL: Record<ActivityKind, string> = {
  news: '뉴스',
  community: '커뮤니티',
  comment: '댓글',
  inquiry: '문의',
  report: '신고',
}

const KIND_TONE: Record<ActivityKind, BadgeTone> = {
  news: 'accent',
  community: 'neutral',
  comment: 'neutral',
  inquiry: 'warn',
  report: 'danger',
}

/** 대시보드 "최근 활동". 네 종류를 한 줄 서식으로 통일해 시간순으로만 읽게 한다. */
export function RecentActivity({ items }: { items: readonly ActivityItem[] }) {
  if (items.length === 0) {
    return <p className="text-muted px-5 py-10 text-center text-[13px]">최근 활동이 없습니다.</p>
  }

  return (
    <ul className="divide-line divide-y">
      {items.map((item) => (
        <li key={item.id}>
          <Link
            href={item.href}
            className="hover:bg-page focus-visible:outline-focus flex items-center gap-3 px-5 py-3 focus-visible:outline-2 focus-visible:-outline-offset-2"
          >
            <Badge tone={KIND_TONE[item.kind]} className="w-[68px] justify-center">
              {KIND_LABEL[item.kind]}
            </Badge>
            <span className="text-ink min-w-0 flex-1 truncate text-[13px]">{item.title}</span>
            <span className="text-muted hidden w-28 truncate text-right text-[12px] sm:block">
              {item.actor}
            </span>
            <time dateTime={item.createdAt} className="text-muted w-20 text-right text-[12px]">
              {formatRelativeDay(item.createdAt)}
            </time>
          </Link>
        </li>
      ))}
    </ul>
  )
}
