'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { requestPasswordResetAction } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(
    requestPasswordResetAction,
    EMPTY_FORM_STATE,
  )

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <FormBanner message={state.formError} />
      <FormBanner message={state.message} tone="success" />

      <Input
        label="이메일"
        name="email"
        type="email"
        autoComplete="username"
        autoFocus
        required
        error={state.fieldErrors?.email}
      />

      <Button type="submit" disabled={isPending} className="mt-1 w-full">
        {isPending ? '보내는 중…' : '재설정 메일 보내기'}
      </Button>

      <Link
        href="/login"
        className="text-muted hover:text-ink focus-visible:outline-focus self-center text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        로그인으로 돌아가기
      </Link>
    </form>
  )
}
