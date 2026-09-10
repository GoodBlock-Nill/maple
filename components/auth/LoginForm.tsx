'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { AuthDivider } from '@/components/auth/AuthDivider'
import { AuthField } from '@/components/auth/AuthField'
import {
  AUTH_ERROR_CLASS,
  AUTH_FORGOT_LINK_CLASS,
  AUTH_FORM_CLASS,
  AUTH_INPUT_CLASS,
  AUTH_MUTED_LINK_CLASS,
  AUTH_NOTICE_CLASS,
  AUTH_SUBMIT_CLASS,
} from '@/components/auth/auth-scene-styles'
import { AuthSocialButtons } from '@/components/auth/AuthSocialButtons'
import { PasswordInput } from '@/components/auth/PasswordInput'
import { signInWithPassword } from '@/lib/actions/email-auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { cn } from '@/lib/utils/cn'

type LoginFormProps = {
  /** 로그인 후 돌아갈 경로. 서버에서 이미 정규화된 값이다. */
  nextPath: string
  /** `?error=` (간편로그인 콜백 실패) 안내. */
  initialError?: string
  /** `?notice=` (비밀번호 변경 완료 등) 안내. */
  notice?: string
}

const FORGOT_PATH = '/forgot-password'

/**
 * 로그인 폼 — 이메일 · 비밀번호 · 간편로그인.
 *
 * "로그인" 버튼은 두 칸이 모두 채워질 때까지 25% 불투명도로 잠긴다(시안).
 * 값을 눌러 담기 위해 제어 컴포넌트로 두지만, 자바스크립트가 꺼져 있어도 폼
 * 제출 자체는 서버 액션으로 그대로 동작한다.
 */
export function LoginForm({ nextPath, initialError, notice }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(signInWithPassword, EMPTY_FORM_STATE)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const canSubmit = email.trim() !== '' && password !== '' && !isPending

  return (
    <div className={AUTH_FORM_CLASS}>
      <form action={formAction} className="flex flex-col">
        <input type="hidden" name="next" value={nextPath} />

        {notice === undefined ? null : (
          <p role="status" className={cn(AUTH_NOTICE_CLASS, 'mt-0 mb-4 text-center')}>
            {notice}
          </p>
        )}

        <div className="flex flex-col gap-6">
          <AuthField label="이메일" htmlFor="login-email" error={state.fieldErrors?.email}>
            <input
              id="login-email"
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

          <div className="flex flex-col">
            <AuthField
              label="비밀번호"
              htmlFor="login-password"
              error={state.fieldErrors?.password}
            >
              <PasswordInput
                id="login-password"
                name="password"
                value={password}
                onValueChange={setPassword}
                placeholder="비밀번호"
                autoComplete="current-password"
                invalid={state.fieldErrors?.password !== undefined}
              />
            </AuthField>

            {/* 입력 아래 8px, 오른쪽 정렬(시안 2041:2301). */}
            <Link href={FORGOT_PATH} className={cn(AUTH_FORGOT_LINK_CLASS, 'mt-2 self-end')}>
              비밀번호를 잊으셨나요
            </Link>
          </div>
        </div>

        {state.formError === undefined ? null : (
          <p role="alert" className={cn(AUTH_ERROR_CLASS, 'mt-6 mb-0 text-center')}>
            {state.formError}
          </p>
        )}

        <button type="submit" disabled={!canSubmit} className={cn(AUTH_SUBMIT_CLASS, 'mt-6')}>
          {isPending ? '로그인 중…' : '로그인'}
        </button>
      </form>

      <div className="mt-6 flex h-6 items-center justify-center gap-5">
        <Link href="/signup" className={AUTH_MUTED_LINK_CLASS}>
          회원가입
        </Link>
        <span aria-hidden className="h-[14px] w-0.5 bg-[#666]" />
        <Link href={FORGOT_PATH} className={AUTH_MUTED_LINK_CLASS}>
          비밀번호 찾기
        </Link>
      </div>

      <div className="mt-8">
        <AuthDivider />
      </div>

      <div className="mt-8">
        <AuthSocialButtons nextPath={nextPath} initialError={initialError} />
      </div>
    </div>
  )
}
