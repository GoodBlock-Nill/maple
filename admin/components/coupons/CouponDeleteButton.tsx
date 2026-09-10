'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button, Dialog, FormBanner, useToast } from '@/components/ui'
import { deleteCouponAction } from '@/lib/actions/coupon-lifecycle-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 쿠폰 삭제 — 등록 내역이 0건일 때만 버튼이 나온다.
 *
 * 이력이 있는 쿠폰은 지우지 않는다(액션과 FK 가 이중으로 막는다). 그래서 이 버튼은
 * "잘못 만든 코드를 치우는" 용도이고, 그 외에는 비활성화가 정답이라는 것도 설명에
 * 적어 둔다 — 삭제 버튼이 보이는 순간 운영자는 그것을 기본 수단으로 여긴다.
 */
export function CouponDeleteButton({ couponId, code }: { couponId: string; code: string }) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await deleteCouponAction(prevState, formData)

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
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        삭제
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="쿠폰 삭제"
        description={`${code} 쿠폰을 완전히 지웁니다. 등록 내역이 한 건도 없을 때만 지워지며 되돌릴 수 없습니다. 더 쓰지 않으려는 것이라면 비활성화가 맞습니다.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="couponId" value={couponId} />

          <FormBanner message={state.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button variant="danger" type="submit" disabled={isPending}>
              {isPending ? '삭제 중…' : '삭제'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
