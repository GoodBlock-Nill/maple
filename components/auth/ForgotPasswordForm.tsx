'use client'

import { useActionState } from 'react'

import { AUTH_FIELD_CLASS } from '@/components/auth/auth-styles'
import { FormFeedback } from '@/components/auth/FormFeedback'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { Input } from '@/components/ui/Input'
import { requestPasswordReset } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

export function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordReset, EMPTY_FORM_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormFeedback state={state} />

      <Input
        label="이메일"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="가입할 때 사용한 이메일"
        error={state.fieldErrors?.email}
        className={AUTH_FIELD_CLASS}
      />

      <SubmitButton pendingLabel="전송 중…">재설정 메일 받기</SubmitButton>
    </form>
  )
}
