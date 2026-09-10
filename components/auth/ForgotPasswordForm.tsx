'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { AuthField } from '@/components/auth/AuthField'
import {
  AUTH_ERROR_CLASS,
  AUTH_FORM_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_MUTED_LINK_CLASS,
  AUTH_NOTICE_CLASS,
  AUTH_SUBMIT_CLASS,
} from '@/components/auth/auth-scene-styles'
import { requestPasswordReset } from '@/lib/actions/email-auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { cn } from '@/lib/utils/cn'

/**
 * 비밀번호 찾기 — 재설정 메일 요청.
 *
 * 성공/실패를 구분하지 않는 안내를 보여 준다(계정 열거 방지). 문구는 서버
 * 액션이 정하고 화면은 그대로 그린다.
 */
export function ForgotPasswordForm() {
  const [state, formAction, isPending] = useActionState(requestPasswordReset, EMPTY_FORM_STATE)
  const [email, setEmail] = useState('')

  return (
    <div className={AUTH_FORM_CLASS}>
      <form action={formAction} className="flex flex-col">
        <AuthField label="이메일" htmlFor="forgot-email" error={state.fieldErrors?.email}>
          <input
            id="forgot-email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="이메일 주소를 입력해주세요"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={state.fieldErrors?.email === undefined ? undefined : true}
            className={cn(AUTH_INPUT_CLASS, 'pr-[23px]')}
          />
        </AuthField>

        {state.message === undefined ? null : (
          <p role="status" className={cn(AUTH_NOTICE_CLASS, 'mt-6 text-center')}>
            {state.message}
          </p>
        )}
        {state.formError === undefined ? null : (
          <p role="alert" className={cn(AUTH_ERROR_CLASS, 'mt-6 text-center')}>
            {state.formError}
          </p>
        )}

        <button
          type="submit"
          disabled={email.trim() === '' || isPending}
          className={cn(AUTH_SUBMIT_CLASS, 'mt-6')}
        >
          {isPending ? '보내는 중…' : '재설정 메일 받기'}
        </button>
      </form>

      <div className="mt-6 flex h-6 items-center justify-center gap-5">
        <Link href="/login" className={AUTH_MUTED_LINK_CLASS}>
          로그인
        </Link>
        <span aria-hidden className="h-[14px] w-0.5 bg-[#666]" />
        <Link href="/signup" className={AUTH_MUTED_LINK_CLASS}>
          회원가입
        </Link>
      </div>
    </div>
  )
}
