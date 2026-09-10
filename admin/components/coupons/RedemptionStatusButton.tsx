'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button, Dialog, FormBanner, Textarea, useToast } from '@/components/ui'
import { updateRedemptionStatusAction } from '@/lib/actions/coupon-redemption-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { COUPON_ADMIN_NOTE_MAX_LENGTH } from '@/lib/validation/coupon-redemptions'

import type { FormState } from '@/lib/actions/form-state'

const COPY = {
  delivered: {
    trigger: '지급완료',
    title: '지급 완료 처리',
    describe: (who: string) =>
      `${who} 님의 등록을 '지급 완료'로 남깁니다. 실제 지급은 게임 안에서 이뤄지므로, 아이템을 넣은 뒤에 눌러 주세요. 되돌릴 수 없습니다.`,
    confirm: '지급완료',
    pending: '처리 중…',
    variant: 'primary',
  },
  rejected: {
    trigger: '거절',
    title: '등록 거절',
    describe: (who: string) =>
      `${who} 님의 등록을 거절합니다. 아이템은 지급되지 않고, 이 건은 쿠폰의 전체 한도를 소모하지 않습니다. 되돌릴 수 없으니 사유를 메모에 남겨 주세요.`,
    confirm: '거절',
    pending: '거절 중…',
    variant: 'danger',
  },
} as const

/**
 * 등록 내역 상태 처리 + 확인 다이얼로그.
 *
 * 되돌릴 수 없는 조작이라 한 단계를 둔다(§7.4 의 3요소). 특히 '지급완료'는 콘솔이
 * 아이템을 주는 것이 아니라 **줬다고 적는 것**이라는 사실을 설명에 박아 둔다 — 이
 * 오해가 그대로 남으면 실제 지급 없이 처리만 끝난 건이 쌓인다.
 *
 * 메모는 선택이지만 거절에는 사실상 필수다. 나중에 문의가 들어왔을 때 "왜 거절됐나"에
 * 답할 수 있는 유일한 기록이다.
 */
export function RedemptionStatusButton({
  redemptionId,
  nickname,
  status,
}: {
  redemptionId: string
  nickname: string
  status: 'delivered' | 'rejected'
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()
  const copy = COPY[status]

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await updateRedemptionStatusAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <>
      <Button
        variant={status === 'delivered' ? 'secondary' : 'ghost'}
        size="sm"
        onClick={() => setOpen(true)}
      >
        {copy.trigger}
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title={copy.title}
        description={copy.describe(nickname)}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="redemptionId" value={redemptionId} />
          <input type="hidden" name="status" value={status} />

          <FormBanner message={state.formError} />

          <Textarea
            label="메모 (선택)"
            name="note"
            rows={3}
            maxLength={COUPON_ADMIN_NOTE_MAX_LENGTH}
            hint="등록 내역 표에 그대로 남습니다. 사용자에게는 보이지 않습니다."
            error={state.fieldErrors?.note}
            disabled={isPending}
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button variant={copy.variant} type="submit" disabled={isPending}>
              {isPending ? copy.pending : copy.confirm}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
