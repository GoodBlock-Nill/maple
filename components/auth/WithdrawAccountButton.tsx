'use client'

import { useActionState, useCallback, useState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { BOARD_DANGER_CLASS } from '@/components/board/board-styles'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { withdrawAccountAction } from '@/lib/actions/account-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { WITHDRAW_DIALOG_DESCRIPTION, WITHDRAW_DIALOG_TITLE } from '@/lib/auth/lifecycle'

import type { ReactNode } from 'react'

const DEFAULT_TRIGGER_CLASS =
  'text-badge-red focus-visible:outline-focus self-start text-[14px] font-medium underline underline-offset-2 hover:no-underline focus-visible:outline-2 focus-visible:outline-offset-2'

type WithdrawAccountButtonProps = {
  /**
   * 트리거 문구. 마이페이지 v2 시안은 문구 옆에 화살표 아이콘이 붙으므로
   * 문자열이 아니라 노드로 받는다(아이콘은 `aria-hidden` 이라 접근 가능한
   * 이름은 그대로 "회원 탈퇴" 하나다).
   */
  label?: ReactNode
  /** 트리거 표면. 지정하지 않으면 기존 작은 밑줄 링크 모양. */
  className?: string
}

/**
 * 회원 탈퇴 트리거 — 확인 모달의 3요소(제목 · 실제로 일어나는 일 · 취소 + 위험
 * 버튼)를 갖춘다(DEVELOPER-GUIDE §7.4).
 *
 * 성공하면 액션이 세션을 끊고 `/?notice=withdrawn` 으로 리다이렉트하므로 여기서
 * 닫을 필요가 없다. 실패했을 때만 모달 안에 사유가 남는다.
 */
export function WithdrawAccountButton({
  label = '회원 탈퇴',
  className,
}: WithdrawAccountButtonProps = {}) {
  const [open, setOpen] = useState(false)
  const [state, formAction, isPending] = useActionState(withdrawAccountAction, EMPTY_FORM_STATE)

  const close = useCallback(() => {
    if (!isPending) {
      setOpen(false)
    }
  }, [isPending])

  return (
    <>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
        className={className ?? DEFAULT_TRIGGER_CLASS}
      >
        {label}
      </button>

      <ConfirmDialog
        open={open}
        title={WITHDRAW_DIALOG_TITLE}
        description={WITHDRAW_DIALOG_DESCRIPTION}
        onCancel={close}
        confirm={
          <form action={formAction}>
            <button type="submit" disabled={isPending} className={BOARD_DANGER_CLASS}>
              {isPending ? '탈퇴 중…' : '탈퇴'}
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
