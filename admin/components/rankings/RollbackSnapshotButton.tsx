'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { rollbackRankingSnapshotAction } from '@/lib/actions/rankings-actions'

import type { FormState } from '@/lib/actions/form-state'
import type { RankType } from '@/lib/validation/rankings'

/**
 * 과거 스냅샷 되돌리기.
 *
 * 되돌리기는 이력을 고쳐 쓰는 것이 아니라 **같은 내용으로 새 스냅샷을 만드는 것**
 * 이다. 다이얼로그 문구도 그렇게 적어야 운영자가 이력이 사라진다고 오해하지 않는다.
 */
export function RollbackSnapshotButton({
  rankType,
  snapshotAt,
  label,
  count,
}: {
  rankType: RankType
  snapshotAt: string
  label: string
  count: number
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const runRollback = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await rollbackRankingSnapshotAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(runRollback, EMPTY_FORM_STATE)

  return (
    <>
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        되돌리기
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="이 스냅샷으로 되돌리기"
        description={`${label} 의 ${count}건을 새 스냅샷으로 다시 올립니다. 기존 이력은 그대로 남습니다.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="rankType" value={rankType} />
          <input type="hidden" name="snapshotAt" value={snapshotAt} />

          <FormBanner message={state.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '적용 중…' : '되돌리기'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
