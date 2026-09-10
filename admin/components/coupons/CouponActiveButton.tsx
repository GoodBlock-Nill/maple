'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button, Dialog, FormBanner, useToast } from '@/components/ui'
import { setCouponActiveAction } from '@/lib/actions/coupon-lifecycle-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 활성 · 비활성 전환 + 확인 다이얼로그.
 *
 * 확인을 세우는 이유는 되돌릴 수 없어서가 아니라 **사용자에게 즉시 보이기 때문**이다.
 * 진행 중인 이벤트의 쿠폰을 끄면 그 순간부터 모든 등록이 "없는 코드"로 떨어진다.
 * 설명에는 그 사실을 그대로 적는다 — "비활성화"라는 단어만 보면 운영자는 "잠깐
 * 숨긴다" 정도로 읽는다(§7.4 의 3요소: 제목 · 실제로 일어나는 일 · 취소+실행).
 */
export function CouponActiveButton({
  couponId,
  code,
  isActive,
  size = 'sm',
}: {
  couponId: string
  code: string
  isActive: boolean
  size?: 'sm' | 'md'
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()
  const next = !isActive

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await setCouponActiveAction(prevState, formData)

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
      <Button variant={next ? 'primary' : 'secondary'} size={size} onClick={() => setOpen(true)}>
        {next ? '활성화' : '비활성화'}
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title={next ? '쿠폰 활성화' : '쿠폰 비활성화'}
        description={
          next
            ? `${code} 코드를 다시 받습니다. 노출 기간 안이라면 곧바로 등록할 수 있게 됩니다. 이미 접수된 등록 내역은 그대로 남아 있습니다.`
            : `${code} 코드를 더 받지 않습니다. 사용자에게는 '사용할 수 없는 코드'로 보이며, 이미 접수된 등록 내역과 지급 상태는 그대로 남습니다.`
        }
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="couponId" value={couponId} />
          <input type="hidden" name="isActive" value={String(next)} />

          <FormBanner message={state.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button variant={next ? 'primary' : 'danger'} type="submit" disabled={isPending}>
              {isPending ? '적용 중…' : next ? '활성화' : '비활성화'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
