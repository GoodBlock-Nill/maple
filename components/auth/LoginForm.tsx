'use client'

import { useActionState } from 'react'

import { AUTH_FIELD_CLASS } from '@/components/auth/auth-styles'
import { FormFeedback } from '@/components/auth/FormFeedback'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { Input } from '@/components/ui/Input'
import { signIn } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

type LoginFormProps = {
  /** 로그인 성공 후 돌아갈 경로. 서버에서 이미 정규화된 값이다. */
  nextPath: string
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const [state, formAction] = useActionState(signIn, EMPTY_FORM_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormFeedback state={state} />

      {/* 서버 액션은 직접 POST 로도 호출되므로 이 값은 서버에서 다시 정규화된다. */}
      <input type="hidden" name="next" value={nextPath} />

      <Input
        label="이메일"
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="you@example.com"
        error={state.fieldErrors?.email}
        className={AUTH_FIELD_CLASS}
      />

      <Input
        label="비밀번호"
        name="password"
        type="password"
        required
        autoComplete="current-password"
        placeholder="비밀번호를 입력해 주세요"
        error={state.fieldErrors?.password}
        className={AUTH_FIELD_CLASS}
      />

      <SubmitButton pendingLabel="로그인 중…">로그인</SubmitButton>
    </form>
  )
}
