'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { signInAction } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

/**
 * 이메일·비밀번호 로그인 폼 — 관리자 콘솔의 **유일한** 로그인 수단이다.
 *
 * 관리자 계정은 초대 메일을 받은 사람이 스스로 비밀번호를 정해 만든다
 * (2026-09-09 제품 결정). 간편로그인은 제거했다.
 *
 * `?error=` 안내(`initialError`)는 액션이 아직 아무것도 돌려주지 않았을 때만
 * 보여 준다 — 새로 시도해 실패했다면 그쪽 문구가 더 정확하다.
 */
/** 로컬 개발용 미리 채움 값. 비어 있으면 빈 칸으로 그린다. */
export type LoginPrefill = { email: string; password: string }

export function LoginForm({
  nextPath,
  prefill,
  initialError,
}: {
  nextPath: string
  prefill?: LoginPrefill
  initialError?: string
}) {
  const [state, formAction, isPending] = useActionState(signInAction, EMPTY_FORM_STATE)
  const bannerMessage =
    state.formError ??
    (initialError !== undefined && initialError !== '' ? initialError : undefined)

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={nextPath} />

      <FormBanner message={bannerMessage} />

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
