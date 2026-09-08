import Link from 'next/link'

import {
  BOARD_ROW_CLASS,
  BOARD_ROW_META_CLASS,
  BOARD_ROW_TITLE_CLASS,
} from '@/components/board/board-styles'
import { MetaRow } from '@/components/board/MetaRow'
import { Badge } from '@/components/ui/Badge'
import { COMMUNITY_CATEGORY_MAP } from '@/lib/constants/board'
import { maskNickname } from '@/lib/utils/mask'

import type { Post } from '@/types/domain'

type PostRowProps = {
  post: Post
}

/**
 * 커뮤니티 목록 행. 뉴스 행(NewsRow)과 같은 그리드를 써서 높이를 맞춘다.
 * 마스킹 작성자는 항상 고정 폭(6자)이라 1행에 두면, 가변 길이인 조회수·좋아요가
 * 있는 2행(MetaRow)은 뉴스와 완전히 같은 모양으로 남길 수 있어 좁은 화면에서도
 * 줄바꿈 없이 행 높이가 어긋나지 않는다.
 */
export function PostRow({ post }: PostRowProps) {
  const category = COMMUNITY_CATEGORY_MAP[post.category]

  return (
    <Link href={`/community/${post.id}`} className={BOARD_ROW_CLASS}>
      <div className="flex items-center gap-4">
        <div className="flex min-w-0 flex-1 items-baseline gap-2">
          <h3 className={BOARD_ROW_TITLE_CLASS + ' min-w-0'}>{post.title}</h3>
          <span className={BOARD_ROW_META_CLASS + ' shrink-0'}>({post.commentCount})</span>
        </div>
        <span className={BOARD_ROW_META_CLASS + ' shrink-0'}>{maskNickname(post.author)}</span>
        <Badge size="md" color={category.badge}>
          {category.label}
        </Badge>
      </div>

      <MetaRow date={post.createdAt} views={post.views} likes={post.likes} />
    </Link>
  )
}
