'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { AUTH_LINK_CLASS } from '@/components/auth/auth-styles'
import { FormFeedback } from '@/components/auth/FormFeedback'
import { SOCIAL_PROVIDER_STYLES } from '@/components/auth/social-providers'
import { socialSignIn } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { cn } from '@/lib/utils/cn'

import type { FormState } from '@/lib/actions/form-state'
import type { SocialProvider } from '@/lib/validation/auth'

type SocialSignInCardProps = {
  /** 로그인 후 돌아갈 경로. 서버에서 이미 정규화된 값이다. */
  nextPath: string
  /** 라우트 핸들러가 `?error=` 로 넘긴 실패 안내. */
  initialError?: string
}

/**
 * 간편로그인 버튼 묶음.
 *
 * 세 버튼을 폼 하나에 담고, 눌린 버튼의 `name="provider"` 값으로 어떤 제공자를
 * 골랐는지 전달한다. 버튼마다 폼을 따로 두면 오류 표시 자리를 셋으로 나눠야 해서
 * 화면이 흔들린다.
 *
 * 자바스크립트가 없어도 폼 제출은 그대로 동작한다(진행 표시만 빠진다).
 */
export function SocialSignInCard({ nextPath, initialError }: SocialSignInCardProps) {
  const [state, formAction, isPending] = useActionState(socialSignIn, EMPTY_FORM_STATE)
  const [clicked, setClicked] = useState<SocialProvider | null>(null)

  /* 액션이 아직 아무것도 돌려주지 않았을 때만 URL 로 받은 오류를 보여 준다.
     새로 시도해 실패했다면 그쪽 문구가 더 정확하다. */
  const feedback: FormState =
    state === EMPTY_FORM_STATE && initialError !== undefined ? { formError: initialError } : state

  return (
    <div className="flex flex-col gap-5">
      <FormFeedback state={feedback} />

      <form action={formAction} className="flex flex-col gap-3">
        {/* 서버 액션은 직접 POST 로도 호출되므로 이 값은 서버에서 다시 정규화된다. */}
        <input type="hidden" name="next" value={nextPath} />

        {SOCIAL_PROVIDER_STYLES.map(({ provider, label, surfaceClass, icon }) => (
          <button
            key={provider}
            type="submit"
            name="provider"
            value={provider}
            disabled={isPending}
            aria-busy={isPending && clicked === provider}
            onClick={() => setClicked(provider)}
            className={cn(
              'rounded-pill flex h-[47px] w-full items-center justify-center gap-2 text-[16px] font-semibold',
              'focus-visible:outline-focus transition-[filter,background-color] duration-150',
              'focus-visible:outline-2 focus-visible:outline-offset-2',
              'active:translate-y-px disabled:pointer-events-none disabled:opacity-60',
              surfaceClass,
            )}
          >
            {icon}
            {isPending && clicked === provider ? '연결 중…' : label}
          </button>
        ))}
      </form>

      <p className="text-ink-muted text-center text-[13px] leading-[1.6]">
        계속 진행하면{' '}
        <Link href="/policy/operating" className={AUTH_LINK_CLASS}>
          이용약관
        </Link>
        과{' '}
        <Link href="/policy/privacy" className={AUTH_LINK_CLASS}>
          개인정보처리방침
        </Link>
        에 동의하는 것으로 간주됩니다.
      </p>
    </div>
  )
}
