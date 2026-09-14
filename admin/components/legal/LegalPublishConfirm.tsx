'use client'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'

import type { LegalConfirmCopy } from '@/lib/validation/legal-state'

/**
 * 발행·예약 저장 확인창.
 *
 * 문구는 `legalConfirmCopy()` 가 만든다(단위 테스트로 못 박혀 있다). 확인창은
 * 되돌릴 수 없는 저장에만 뜬다 — 발행한 개정본은 고칠 수 없고, 예약도 시행일이
 * 되면 아무도 누르지 않는 사이 공개되기 때문이다.
 */
export function LegalPublishConfirm({
  copy,
  onCancel,
  onConfirm,
}: {
  /** null 이면 닫힌 상태. */
  copy: LegalConfirmCopy | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog
      open={copy !== null}
      onClose={onCancel}
      title={copy?.title ?? ''}
      description={copy?.description}
    >
      <div className="flex justify-end gap-2" data-testid="legal-publish-confirm">
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button onClick={onConfirm}>{copy?.action ?? ''}</Button>
      </div>
    </Dialog>
  )
}
