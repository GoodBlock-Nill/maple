'use client'

import { useId } from 'react'

import { DialogShell } from '@/components/ui/DialogShell'

import type { ReactNode } from 'react'

type ConfirmDialogProps = {
  open: boolean
  title: string
  description?: string
  cancelLabel?: string
  onCancel: () => void
  /**
   * 확인 동작. 서버 액션 폼을 그대로 넣을 수 있도록 노드로 받는다.
   * (onConfirm 콜백으로 좁히면 `<form action={...}>` 을 쓸 수 없다.)
   */
  confirm: ReactNode
  /** 폼 상단 알림 등 확인 버튼 위에 붙일 내용. */
  children?: ReactNode
}

/**
 * 되돌릴 수 없는 동작 앞에 세우는 확인 모달.
 *
 * 파괴적 동작을 오른쪽에 두고 취소를 왼쪽에 둔다. 포커스는 트랩 규칙상 첫 번째
 * 포커스 가능 요소(취소)로 들어가므로, Enter 를 반사적으로 눌러도 삭제되지 않는다.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  cancelLabel = '취소',
  onCancel,
  confirm,
  children,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <DialogShell
      open={open}
      onClose={onCancel}
      labelledBy={titleId}
      describedBy={description === undefined ? undefined : descriptionId}
      className="max-w-[400px]"
    >
      <h2 id={titleId} className="text-ink text-[18px] font-semibold">
        {title}
      </h2>

      {description === undefined ? null : (
        <p id={descriptionId} className="text-ink-muted mt-2 text-[15px] leading-[1.6]">
          {description}
        </p>
      )}

      {children}

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="cta-light rounded-pill text-ink focus-visible:outline-focus inline-flex h-11 items-center px-5 text-[15px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          {cancelLabel}
        </button>
        {confirm}
      </div>
    </DialogShell>
  )
}
