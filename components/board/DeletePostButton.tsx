'use client'

import { useActionState, useCallback, useState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { BOARD_ACTION_CLASS, BOARD_DANGER_CLASS } from '@/components/board/board-styles'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { deletePost } from '@/lib/actions/post-edit-actions'

type DeletePostButtonProps = {
  postId: string
}

/**
 * 작성자 본인의 글 삭제(소프트 삭제).
 *
 * 성공하면 액션이 `/community?deleted=1` 로 리다이렉트하므로 여기서 닫을 필요가
 * 없다. 실패했을 때만 모달 안에 사유가 남는다.
 */
export function DeletePostButton({ postId }: DeletePostButtonProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(
    deletePost.bind(null, postId),
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
        open={open}
        title="게시글을 삭제할까요?"
        description="삭제한 글은 복구할 수 없습니다."
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
