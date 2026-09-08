import { Button } from '@/components/ui/Button'
import { Textarea } from '@/components/ui/Textarea'
import { LOGIN_REQUIRED_NOTICE } from '@/lib/constants/board'
import { formatDateLong } from '@/lib/utils/format-date'
import { maskNickname } from '@/lib/utils/mask'

import type { Comment } from '@/types/domain'

const COMMENT_FIELD_CLASS =
  'rounded-[10px] border-line-soft text-[17px] placeholder:text-[#9a9a9a] disabled:bg-sheet'

type CommentSectionProps = {
  comments: readonly Comment[]
}

/** 댓글 목록 + 작성 폼(UI 전용). 백엔드 연동 전까지 제출은 비활성 상태다. */
export function CommentSection({ comments }: CommentSectionProps) {
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

      <form className="mt-8 flex flex-col gap-3">
        <Textarea
          label="댓글 작성"
          hint={LOGIN_REQUIRED_NOTICE}
          placeholder="댓글을 입력해주세요"
          rows={4}
          disabled
          className={COMMENT_FIELD_CLASS}
        />
        <Button type="submit" disabled className="self-end">
          등록
        </Button>
      </form>
    </section>
  )
}
