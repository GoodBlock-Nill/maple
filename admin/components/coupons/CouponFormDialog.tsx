'use client'

import { useActionState, useCallback, useState } from 'react'

import { CouponFormFields } from '@/components/coupons/CouponFormFields'
import { Button, Dialog, FormBanner, useToast } from '@/components/ui'
import { createCouponAction, updateCouponAction } from '@/lib/actions/coupons-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'
import type { CouponDetail } from '@/lib/data/coupons'

/**
 * 쿠폰 만들기 · 수정 다이얼로그.
 *
 * 등록에 **확인 모달을 겹치지 않는다.** 되돌리기 어려운 조작에만 확인을 세운다는 규약
 * (§7.4)에 따라, 만들기·수정은 폼 제출로 끝내고 비활성화·삭제만 한 단계를 더 둔다.
 *
 * 다이얼로그가 닫히면 내용이 언마운트되므로 입력 상태(코드 칸)는 저절로 초기화된다.
 * `useActionState` 는 바깥에 있어 실패 문구가 남지만, 다시 열어 제출하면 덮인다.
 */
export function CouponFormDialog({
  coupon,
  triggerLabel,
  triggerVariant = 'primary',
  triggerSize,
}: {
  /** 없으면 등록, 있으면 수정. */
  coupon?: CouponDetail
  triggerLabel: string
  triggerVariant?: 'primary' | 'secondary'
  triggerSize?: 'sm' | 'md'
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()
  const isEdit = coupon !== undefined

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = isEdit
        ? await updateCouponAction(prevState, formData)
        : await createCouponAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [isEdit, showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <>
      <Button
        variant={triggerVariant}
        size={triggerSize ?? (isEdit ? 'sm' : 'md')}
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title={isEdit ? '쿠폰 수정' : '쿠폰 만들기'}
        description="코드는 사용자가 마이페이지 쿠폰 탭에 그대로 입력합니다."
      >
        <form
          action={formAction}
          className="flex max-h-[70vh] flex-col gap-4 overflow-y-auto pr-1"
          noValidate
        >
          {isEdit && <input type="hidden" name="couponId" value={coupon.id} />}

          <FormBanner message={state.formError} />

          <CouponFormFields coupon={coupon} fieldErrors={state.fieldErrors} isPending={isPending} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '저장 중…' : isEdit ? '수정' : '만들기'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
