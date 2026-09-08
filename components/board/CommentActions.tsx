import Link from 'next/link'

import { BOARD_ACTION_CLASS } from '@/components/board/board-styles'
import { DeleteCommentButton } from '@/components/board/DeleteCommentButton'
import { ReportDialog } from '@/components/board/ReportDialog'
import { isAuthor } from '@/lib/utils/authorship'

type CommentActionsProps = {
  postId: string
  commentId: string
  authorId: string | null
  viewerId: string | null
  detailPath: string
  /** 뷰어 본인의 정지 안내. 신고 다이얼로그가 그대로 그린다. */
  suspensionNotice?: string | null
}

/** 댓글 한 줄의 액션. 규칙은 게시글과 같다(작성자 → 삭제, 그 외 → 신고). */
export function CommentActions({
  postId,
  commentId,
  authorId,
  viewerId,
  detailPath,
  suspensionNotice = null,
}: CommentActionsProps) {
  if (isAuthor(authorId, viewerId)) {
    return <DeleteCommentButton postId={postId} commentId={commentId} />
  }

  if (viewerId === null) {
    return (
      <Link href={`/login?next=${encodeURIComponent(detailPath)}`} className={BOARD_ACTION_CLASS}>
        신고
      </Link>
    )
  }

  return (
    <ReportDialog
      targetType="comment"
      targetId={commentId}
      nextPath={detailPath}
      suspensionNotice={suspensionNotice}
    />
  )
}
