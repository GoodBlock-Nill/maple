'use client'

import { useCallback, useId, useState } from 'react'

import { BOARD_ACTION_CLASS } from '@/components/board/board-styles'
import { ReportForm } from '@/components/board/ReportForm'
import { DialogShell } from '@/components/ui/DialogShell'

import type { ReportTargetType } from '@/lib/constants/report'

type ReportDialogProps = {
  targetType: ReportTargetType
  targetId: string
  /** 비로그인 상태에서 액션이 직접 호출됐을 때 로그인 후 돌아올 경로. */
  nextPath: string
  label?: string
  /** 다이얼로그 시각 검증용 하네스에서만 쓴다. 실제 화면은 항상 닫힌 채 시작한다. */
  defaultOpen?: boolean
}

/**
 * 신고 트리거 + 다이얼로그.
 *
 * 게시글과 댓글이 같은 컴포넌트를 쓴다. 대상 종류는 `targetType` 으로만 갈리고,
 * 서버 액션(`submitReport`)이 그 값을 다시 검증한다.
 */
export function ReportDialog({
  targetType,
  targetId,
  nextPath,
  label = '신고',
  defaultOpen = false,
}: ReportDialogProps) {
  const [open, setOpen] = useState(defaultOpen)
  const titleId = useId()

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
        {label}
      </button>

      <DialogShell open={open} onClose={close} labelledBy={titleId}>
        <ReportForm
          targetType={targetType}
          targetId={targetId}
          nextPath={nextPath}
          titleId={titleId}
          onClose={close}
        />
      </DialogShell>
    </>
  )
}
