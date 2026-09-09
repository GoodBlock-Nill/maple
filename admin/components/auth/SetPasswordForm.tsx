'use client'

import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { setPasswordAction } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { ADMIN_PASSWORD_MAX_LENGTH, ADMIN_PASSWORD_MIN_LENGTH } from '@/lib/validation/auth'

/** 비밀번호 재설정(`/reset-password`)에서 쓴다. */
export function SetPasswordForm({
  submitLabel,
  nextPath = '/',
}: {
  submitLabel: string
  nextPath?: string
}) {
  const [state, formAction, isPending] = useActionState(setPasswordAction, EMPTY_FORM_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={nextPath} />

      <FormBanner message={state.formError} />

      <Input
        label="새 비밀번호"
        name="password"
        type="password"
        autoComplete="new-password"
        autoFocus
        required
        maxLength={ADMIN_PASSWORD_MAX_LENGTH}
        hint={`${ADMIN_PASSWORD_MIN_LENGTH}~${ADMIN_PASSWORD_MAX_LENGTH}자. 어깨너머로 길이가 읽히지 않도록 글자수는 세지 않습니다.`}
        error={state.fieldErrors?.password}
      />
      <Input
        label="새 비밀번호 확인"
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        required
        maxLength={ADMIN_PASSWORD_MAX_LENGTH}
        error={state.fieldErrors?.passwordConfirm}
      />

      <Button type="submit" disabled={isPending} className="mt-1 w-full">
        {isPending ? '저장 중…' : submitLabel}
      </Button>
    </form>
  )
}
