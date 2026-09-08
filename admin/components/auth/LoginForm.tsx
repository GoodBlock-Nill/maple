'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { signInAction } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

export function LoginForm({ nextPath, initialError }: { nextPath: string; initialError?: string }) {
  const [state, formAction, isPending] = useActionState(signInAction, EMPTY_FORM_STATE)

  /* 액션이 아직 한 번도 돌지 않았을 때만 URL 에서 온 안내(?error=expired 등)를
     보여 준다. 그 뒤에는 액션 결과가 항상 우선한다. */
  const bannerMessage = state.formError ?? (initialError !== '' ? initialError : undefined)

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="next" value={nextPath} />

      <FormBanner message={bannerMessage} />

      <Input
        label="이메일"
        name="email"
        type="email"
        autoComplete="username"
        autoFocus
        required
        error={state.fieldErrors?.email}
      />
      <Input
        label="비밀번호"
        name="password"
        type="password"
        autoComplete="current-password"
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
