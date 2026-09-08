'use client'

import { useActionState, useCallback, useState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { BOARD_ACTION_CLASS, BOARD_DANGER_CLASS } from '@/components/board/board-styles'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { deleteComment } from '@/lib/actions/post-edit-actions'

type DeleteCommentButtonProps = {
  postId: string
  commentId: string
}

/**
 * 작성자 본인의 댓글 삭제(소프트 삭제).
 *
 * 댓글 삭제는 리다이렉트하지 않고 상세를 재검증만 한다. 성공 상태가 오면 모달을
 * 닫아야 하는데, 이를 effect 안의 setState 로 처리하면 렌더가 한 번 더 돈다.
 * 열림 여부를 `open && 아직 안 지워짐` 으로 파생시켜 그 왕복을 없앤다.
 * 재검증이 끝나면 댓글 줄과 함께 이 버튼도 사라진다.
 */
export function DeleteCommentButton({ postId, commentId }: DeleteCommentButtonProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(
    deleteComment.bind(null, postId, commentId),
    EMPTY_FORM_STATE,
  )

  const close = useCallback(() => {
    setOpen(false)
  }, [])

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={BOARD_ACTION_CLASS}
      >
        삭제
      </button>

      <ConfirmDialog
        open={open && state.message === undefined}
        title="댓글을 삭제할까요?"
        description="삭제한 댓글은 복구할 수 없습니다."
        onCancel={close}
        confirm={
          <form action={formAction}>
            <button type="submit" disabled={isPending} className={BOARD_DANGER_CLASS}>
              {isPending ? '삭제 중' : '삭제'}
            </button>
          </form>
        }
      >
        <div className="mt-4 empty:mt-0">
          <FormFeedback state={state} />
        </div>
      </ConfirmDialog>
    </>
  )
}
