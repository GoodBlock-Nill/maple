import { CommentActions } from '@/components/board/CommentActions'
import { CommentForm } from '@/components/board/CommentForm'
import { formatDateLong } from '@/lib/utils/format-date'
import { maskNickname } from '@/lib/utils/mask'

import type { Comment } from '@/types/domain'

type CommentSectionProps = {
  postId: string
  comments: readonly Comment[]
  /** 로그인 상태에 따라 작성 폼과 로그인 유도 중 하나를 그린다. */
  isAuthenticated: boolean
  /** 로그인한 사용자의 uuid. 본인 댓글에만 삭제를 연다. */
  viewerId: string | null
}

/**
 * 댓글 목록 + 작성 폼.
 *
 * 삭제된 댓글은 데이터 계층(`getComments`)이 `deleted_at is null` 로 이미 걸러
 * 낸다. 대댓글이 없어 순서가 삭제에 의존하지 않으므로 자리를 남기지 않는다.
 */
export function CommentSection({
  postId,
  comments,
  isAuthenticated,
  viewerId,
}: CommentSectionProps) {
  const detailPath = `/community/${postId}`

  return (
    <section aria-labelledby="comments-heading" className="border-line mt-10 border-t pt-8">
      <h3 id="comments-heading" className="text-ink text-[20px] font-semibold">
        댓글 <span className="text-ink-muted">({comments.length})</span>
      </h3>

      {comments.length === 0 ? (
        <p className="text-ink-muted mt-4 text-[16px]">첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {comments.map((comment) => (
            <li key={comment.id} className="border-line border-b py-4 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-ink text-[16px] font-semibold">
                    {maskNickname(comment.author)}
                  </span>
                  <time dateTime={comment.createdAt} className="text-ink-muted text-[14px]">
                    {formatDateLong(comment.createdAt)}
                  </time>
                </div>
                <CommentActions
                  postId={postId}
                  commentId={comment.id}
                  authorId={comment.authorId}
                  viewerId={viewerId}
                  detailPath={detailPath}
                />
              </div>
              <p className="text-ink mt-1.5 text-[17px] leading-[1.7]">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <CommentForm postId={postId} isAuthenticated={isAuthenticated} />
    </section>
  )
}
