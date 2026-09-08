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
  /** 뷰어 본인의 정지 안내. 넘어오면 다이얼로그가 배너를 띄우고 접수를 막는다. */
  suspensionNotice?: string | null
  /** 다이얼로그 시각 검증용 하네스에서만 쓴다. 실제 화면은 항상 닫힌 채 시작한다. */
  defaultOpen?: boolean
}

/**
 * 신고 트리거 + 다이얼로그.
 *
 * 게시글과 댓글이 같은 컴포넌트를 쓴다. 대상 종류는 `targetType` 으로만 갈리고,
 * 서버 액션(`submitReport`)이 그 값을 다시 검증한다.
 *
 * 정지 계정에게도 트리거는 그대로 보인다. 버튼을 감추면 "신고할 방법이 있다"는
 * 사실까지 사라져, 정지가 풀린 뒤에도 경로를 못 찾는다. 대신 열었을 때 이유를
 * 알려 주고 접수만 막는다.
 */
export function ReportDialog({
  targetType,
  targetId,
  nextPath,
  label = '신고',
  suspensionNotice = null,
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
          suspensionNotice={suspensionNotice}
          onClose={close}
        />
      </DialogShell>
    </>
  )
}
