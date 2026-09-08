'use client'

import { useActionState, useCallback, useState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { BOARD_ACTION_CLASS, BOARD_DANGER_CLASS } from '@/components/board/board-styles'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { cancelInquiry } from '@/lib/actions/inquiry-edit-actions'
import {
  INQUIRY_CANCEL_CONFIRM_DESCRIPTION,
  INQUIRY_CANCEL_CONFIRM_LABEL,
  INQUIRY_CANCEL_CONFIRM_TITLE,
  INQUIRY_CANCEL_LABEL,
} from '@/lib/constants/support'

type CancelInquiryButtonProps = {
  inquiryId: string
}

/**
 * 접수 취소.
 *
 * 되돌릴 수 없는 동작이라 확인 모달을 한 번 세운다(글 삭제와 같은 규격이라
 * 게시판의 액션·위험 버튼 스타일을 그대로 쓴다 — 같은 성격의 버튼이 화면마다
 * 달라 보일 이유가 없다).
 *
 * 성공하면 액션이 상세로 리다이렉트하므로 여기서 모달을 닫을 필요가 없다.
 * 실패했을 때만 모달 안에 사유가 남는다.
 */
export function CancelInquiryButton({ inquiryId }: CancelInquiryButtonProps) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(
    cancelInquiry.bind(null, inquiryId),
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
        {INQUIRY_CANCEL_LABEL}
      </button>

      <ConfirmDialog
        open={open}
        title={INQUIRY_CANCEL_CONFIRM_TITLE}
        description={INQUIRY_CANCEL_CONFIRM_DESCRIPTION}
        onCancel={close}
        confirm={
          <form action={formAction}>
            <button type="submit" disabled={isPending} className={BOARD_DANGER_CLASS}>
              {isPending ? '취소 중' : INQUIRY_CANCEL_CONFIRM_LABEL}
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
