'use client'

import { useActionState } from 'react'

import { AUTH_FIELD_CLASS } from '@/components/auth/auth-styles'
import { FormFeedback } from '@/components/auth/FormFeedback'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { Input } from '@/components/ui/Input'
import { signUp } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/lib/validation/auth'

type RegisterFormProps = {
  nextPath: string
}

export function RegisterForm({ nextPath }: RegisterFormProps) {
  const [state, formAction] = useActionState(signUp, EMPTY_FORM_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <FormFeedback state={state} />

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
        label="닉네임"
        name="nickname"
        type="text"
        required
        minLength={NICKNAME_MIN_LENGTH}
        maxLength={NICKNAME_MAX_LENGTH}
        autoComplete="nickname"
        placeholder={`${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자`}
        hint="게시판에는 앞 3글자만 노출됩니다."
        error={state.fieldErrors?.nickname}
        className={AUTH_FIELD_CLASS}
      />

      <Input
        label="비밀번호"
        name="password"
        type="password"
        required
        minLength={PASSWORD_MIN_LENGTH}
        autoComplete="new-password"
        placeholder={`${PASSWORD_MIN_LENGTH}자 이상`}
        error={state.fieldErrors?.password}
        className={AUTH_FIELD_CLASS}
      />

      <SubmitButton pendingLabel="가입 중…">회원가입</SubmitButton>
    </form>
  )
}
