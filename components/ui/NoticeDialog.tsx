'use client'

import { useId } from 'react'

import { DialogShell } from '@/components/ui/DialogShell'

const CONFIRM_CLASS =
  'cta-dark rounded-pill focus-visible:outline-focus inline-flex h-11 items-center justify-center ' +
  'px-6 text-[15px] font-semibold transition-[filter] hover:brightness-125 ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2'

type NoticeDialogProps = {
  open: boolean
  title: string
  description?: string
  confirmLabel?: string
  /** 확인 버튼 · 배경 클릭 · Escape 가 모두 이 콜백으로 모인다. */
  onClose: () => void
}

/**
 * 알림 모달 — 제목 한 줄 + "확인" 하나.
 *
 * `ConfirmDialog` 는 되돌릴 수 없는 동작 앞에 세우는 확인(취소 + 위험 버튼)이라
 * 이미 끝난 일을 알리는 자리에는 맞지 않는다. 껍데기(딤 · 포커스 트랩 · Escape ·
 * 스크롤 잠금)는 같은 `DialogShell` 을 쓴다.
 */
export function NoticeDialog({
  open,
  title,
  description,
  confirmLabel = '확인',
  onClose,
}: NoticeDialogProps) {
  const titleId = useId()
  const descriptionId = useId()

  return (
    <DialogShell
      open={open}
      onClose={onClose}
      labelledBy={titleId}
      describedBy={description === undefined ? undefined : descriptionId}
      className="max-w-[400px]"
    >
      <h2 id={titleId} className="text-ink text-[18px] leading-[26px] font-semibold">
        {title}
      </h2>

      {description === undefined ? null : (
        <p id={descriptionId} className="text-ink-muted mt-2 text-[15px] leading-[1.6]">
          {description}
        </p>
      )}

      <div className="mt-6 flex justify-end">
        <button type="button" onClick={onClose} className={CONFIRM_CLASS}>
          {confirmLabel}
        </button>
      </div>
    </DialogShell>
  )
}
