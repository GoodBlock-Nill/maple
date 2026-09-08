import Link from 'next/link'

import { BOARD_CARD_CLASS, BOARD_TITLE_CLASS } from '@/components/board/board-styles'
import { MetaRow } from '@/components/board/MetaRow'
import { Badge } from '@/components/ui/Badge'
import { COMMUNITY_CATEGORY_MAP } from '@/lib/constants/board'
import { cn } from '@/lib/utils/cn'
import { maskNickname } from '@/lib/utils/mask'

import type { Post } from '@/types/domain'

type PostRowProps = {
  post: Post
}

/** 커뮤니티 목록 행. 1행 h48(뱃지·제목·댓글수) + 2행(메타 / 작성자). */
export function PostRow({ post }: PostRowProps) {
  const category = COMMUNITY_CATEGORY_MAP[post.category]

  return (
    <Link
      href={`/community/${post.id}`}
      className={cn(BOARD_CARD_CLASS, 'flex flex-col gap-5 px-6 py-[15px]')}
    >
      <div className="flex min-w-0 items-center gap-6 sm:h-12">
        <Badge size="md" color={category.badge}>
          {category.label}
        </Badge>
        <div className="flex min-w-0 items-baseline gap-2.5">
          <h3 className={BOARD_TITLE_CLASS}>{post.title}</h3>
          <span className="text-ink-muted shrink-0 text-[clamp(15px,2vw,27px)] font-medium">
            ({post.comments.length})
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <MetaRow date={post.createdAt} views={post.views} likes={post.likes} />
        <span className="text-ink-muted text-[clamp(18px,2vw,26px)] leading-[1.25] font-medium">
          {maskNickname(post.author)}
        </span>
      </div>
    </Link>
  )
}
