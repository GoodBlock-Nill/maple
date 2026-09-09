import { CommentActions } from '@/components/board/CommentActions'
import { CommentForm } from '@/components/board/CommentForm'
import { formatDateLong } from '@/lib/utils/format-date'
import { authorLabel } from '@/lib/utils/author-display'

import type { Comment } from '@/types/domain'

type CommentSectionProps = {
  postId: string
  comments: readonly Comment[]
  /** 로그인 상태에 따라 작성 폼과 로그인 유도 중 하나를 그린다. */
  isAuthenticated: boolean
  /** 로그인한 사용자의 uuid. 본인 댓글에만 삭제를 연다. */
  viewerId: string | null
  /** 뷰어 본인의 정지 안내. 작성 폼과 신고 다이얼로그가 같은 문구를 쓴다. */
  suspensionNotice?: string | null
  /** 월드 계정 연동 필수 안내(플래그 ON · 연동 전). 작성 폼만 잠근다. */
  mswLinkNotice?: string | null
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
  suspensionNotice = null,
  mswLinkNotice = null,
}: CommentSectionProps) {
  const detailPath = `/community/${postId}`

  return (
    <section aria-labelledby="comments-heading" className="border-line mt-10 border-t pt-8">
      <h3 id="comments-heading" className="text-ink text-label-lg font-semibold">
        댓글 <span className="text-ink-muted">({comments.length})</span>
      </h3>

      {comments.length === 0 ? (
        <p className="text-ink-muted text-ui-sm mt-4">첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="mt-4 flex flex-col">
          {comments.map((comment) => (
            <li key={comment.id} className="border-line border-b py-4 last:border-b-0">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="text-ink text-ui-sm font-semibold">{authorLabel(comment)}</span>
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
                  suspensionNotice={suspensionNotice}
                />
              </div>
              <p className="text-ink text-prose mt-1.5 leading-[1.7]">{comment.body}</p>
            </li>
          ))}
        </ul>
      )}

      <CommentForm
        postId={postId}
        isAuthenticated={isAuthenticated}
        suspensionNotice={suspensionNotice}
        mswLinkNotice={mswLinkNotice}
      />
    </section>
  )
}
