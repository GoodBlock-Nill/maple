'use client'

import { useActionState, useState } from 'react'

import { AuthField } from '@/components/auth/AuthField'
import {
  AUTH_ERROR_CLASS,
  AUTH_FORM_CLASS,
  AUTH_SUBMIT_CLASS,
} from '@/components/auth/auth-scene-styles'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { updatePassword } from '@/lib/actions/email-auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { passwordConfirmIssue, passwordIssue } from '@/lib/auth/signup-steps'
import { cn } from '@/lib/utils/cn'
import { isStrongPassword } from '@/lib/validation/email-auth'

/**
 * 비밀번호 재설정 — 메일 링크로 열린 세션에서 새 비밀번호를 저장한다.
 *
 * 저장에 성공하면 서버 액션이 세션을 끊고 `/login?notice=password_updated` 로
 * 보내므로 이 화면에는 성공 상태가 남지 않는다.
 */
export function ResetPasswordForm() {
  const [state, formAction, isPending] = useActionState(updatePassword, EMPTY_FORM_STATE)
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const passwordError = state.fieldErrors?.password ?? passwordIssue(password)
  const confirmError =
    state.fieldErrors?.passwordConfirm ?? passwordConfirmIssue(password, passwordConfirm)
  const canSubmit = isStrongPassword(password) && password === passwordConfirm && !isPending

  return (
    <div className={AUTH_FORM_CLASS}>
      <form action={formAction} className="flex flex-col">
        <AuthField label="새 비밀번호" htmlFor="reset-password" error={passwordError}>
          <PasswordInput
            id="reset-password"
            name="password"
            value={password}
            onValueChange={setPassword}
            placeholder="비밀번호"
            autoComplete="new-password"
            clearable
            invalid={passwordError !== null && passwordError !== undefined}
          />
        </AuthField>

        <AuthField
          label="새 비밀번호 재입력"
          htmlFor="reset-password-confirm"
          hideLabel
          error={confirmError}
          className="mt-2"
        >
          <PasswordInput
            id="reset-password-confirm"
            name="passwordConfirm"
            value={passwordConfirm}
            onValueChange={setPasswordConfirm}
            placeholder="비밀번호 재입력"
            autoComplete="new-password"
            invalid={confirmError !== null && confirmError !== undefined}
          />
        </AuthField>

        {state.formError === undefined ? null : (
          <p role="alert" className={cn(AUTH_ERROR_CLASS, 'mt-6 text-center')}>
            {state.formError}
          </p>
        )}

        <button type="submit" disabled={!canSubmit} className={cn(AUTH_SUBMIT_CLASS, 'mt-6')}>
          {isPending ? '변경 중…' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  )
}
