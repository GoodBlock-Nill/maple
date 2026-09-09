'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { signInAction } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

/**
 * 이메일·비밀번호 로그인 폼 — **보조 수단**이다.
 *
 * 관리자 계정은 간편로그인으로 가입한 회원을 승격해 만든다(2026-09-09 제품 결정).
 * 이 폼은 실 OAuth 가 붙기 전까지 부트스트랩 관리자가 들어올 문으로만 남는다.
 *
 * `?error=` 안내는 여기가 아니라 항상 보이는 간편로그인 쪽(`SocialSignInButtons`)이
 * 그린다 — 이 섹션은 접혀 있어서 배너를 넣어도 보이지 않는다.
 */
/** 로컬 개발용 미리 채움 값. 비어 있으면 빈 칸으로 그린다. */
export type LoginPrefill = { email: string; password: string }

export function LoginForm({ nextPath, prefill }: { nextPath: string; prefill?: LoginPrefill }) {
  const [state, formAction, isPending] = useActionState(signInAction, EMPTY_FORM_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={nextPath} />

      <FormBanner message={state.formError} />

      <Input
        label="이메일"
        name="email"
        type="email"
        autoComplete="username"
        defaultValue={prefill?.email ?? ''}
        required
        error={state.fieldErrors?.email}
      />
      <Input
        label="비밀번호"
        name="password"
        type="password"
        autoComplete="current-password"
        defaultValue={prefill?.password ?? ''}
        required
        error={state.fieldErrors?.password}
      />

      <Button type="submit" disabled={isPending} className="mt-1 w-full">
        {isPending ? '로그인 중…' : '로그인'}
      </Button>

      <Link
        href="/forgot-password"
        className="text-muted hover:text-ink focus-visible:outline-focus self-center text-[13px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        비밀번호 재설정
      </Link>
    </form>
  )
}
