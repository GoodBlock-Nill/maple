'use client'

import { useActionState, useCallback } from 'react'

import { Button, FormError, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { updateInquiryStatusAction } from '@/lib/actions/inquiries-actions'
import {
  INQUIRY_STATUS_LABELS,
  INQUIRY_STATUS_TRANSITIONS,
  type InquiryStatus,
} from '@/lib/validation/inquiries'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 상세 헤더의 상태 변경.
 *
 * select 에는 **현재 상태에서 갈 수 있는 곳만** 담는다. 갈 수 없는 값을 보여 주고
 * 누른 뒤에 거절하면 운영자는 규칙을 화면에서 배울 수 없다. 서버 액션도 같은 표로
 * 다시 검사하므로(직접 POST 방어) 화면은 안내 역할만 한다.
 */
export function InquiryStatusForm({
  inquiryId,
  status,
  isLocked,
}: {
  inquiryId: string
  status: InquiryStatus
  /** 사용자가 접수를 취소한 문의는 읽기 전용이다. */
  isLocked: boolean
}) {
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await updateInquiryStatusAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)
  const options = INQUIRY_STATUS_TRANSITIONS[status]

  if (isLocked || options.length === 0) {
    return null
  }

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="inquiryId" value={inquiryId} />

      <div className="flex items-center gap-2">
        <label className="sr-only" htmlFor="inquiry-status">
          상태 변경
        </label>
        <select
          id="inquiry-status"
          name="status"
          defaultValue={options[0]}
          disabled={isPending}
          className="rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-9 border px-3 text-[13px] focus:outline-2"
        >
          {options.map((option) => (
            <option key={option} value={option}>
              {INQUIRY_STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        <Button type="submit" size="sm" disabled={isPending}>
          {isPending ? '변경 중…' : '상태 변경'}
        </Button>
      </div>

      <FormError message={state.formError} />
    </form>
  )
}
