'use client'

import { useActionState, useCallback } from 'react'

import { Button, type ButtonVariant } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 배너 목록의 한 줄짜리 조작(노출 전환 · 순서 이동 · 삭제).
 *
 * 조작마다 버튼을 따로 만들지 않고 액션과 숨은 필드를 받는다. 목록의 행마다
 * 훅을 세 벌씩 두면 행 컴포넌트가 조작 코드로 뒤덮여 정작 데이터가 안 보인다.
 *
 * 결과는 토스트로만 알린다 — 목록은 서버 액션의 `revalidatePath` 로 다시 그려진다.
 */
export function BannerActionButton({
  action,
  fields,
  label,
  pendingLabel,
  variant = 'secondary',
  disabled = false,
  ariaLabel,
}: {
  action: (prevState: FormState, formData: FormData) => Promise<FormState>
  fields: Record<string, string>
  label: string
  pendingLabel?: string
  variant?: ButtonVariant
  disabled?: boolean
  ariaLabel?: string
}) {
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await action(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
      }

      if (result.formError !== undefined) {
        showToast(result.formError, 'error')
      }

      return result
    },
    [action, showToast],
  )

  const [, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <form action={formAction} className="inline-flex">
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} readOnly />
      ))}
      <Button
        type="submit"
        size="sm"
        variant={variant}
        disabled={disabled || isPending}
        aria-label={ariaLabel}
      >
        {isPending ? (pendingLabel ?? '처리 중…') : label}
      </Button>
    </form>
  )
}
