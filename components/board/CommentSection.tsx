import { CommentForm } from '@/components/board/CommentForm'
import { formatDateLong } from '@/lib/utils/format-date'
import { maskNickname } from '@/lib/utils/mask'

import type { Comment } from '@/types/domain'

type CommentSectionProps = {
  postId: string
  comments: readonly Comment[]
  /** 로그인 상태에 따라 작성 폼과 로그인 유도 중 하나를 그린다. */
  isAuthenticated: boolean
}

/** 댓글 목록 + 작성 폼. */
export function CommentSection({ postId, comments, isAuthenticated }: CommentSectionProps) {
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
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <span className="text-ink text-[16px] font-semibold">
                  {maskNickname(comment.author)}
                </span>
                <time dateTime={comment.createdAt} className="text-ink-muted text-[14px]">
                  {formatDateLong(comment.createdAt)}
                </time>
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
