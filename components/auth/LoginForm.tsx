'use client'

import { useActionState, useState } from 'react'

import { GoogleGlyph, NaverGlyph, NoticeGlyph } from '@/components/auth/auth-icons'
import { socialSignIn } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { cn } from '@/lib/utils/cn'

import type { SocialProvider } from '@/lib/validation/auth'
import type { ReactNode } from 'react'

/**
 * 간편로그인 버튼(시안 auth-v2 §PC 본문).
 *
 * 이 사이트의 로그인 수단은 구글·네이버 둘뿐이다 — 시안에서 카카오 버튼은
 * 숨김 처리되어 있다. 제공자 목록(`SOCIAL_PROVIDERS`)에는 카카오가 남아 있으므로
 * 언제든 이 배열에 한 줄을 더하면 되살아난다.
 *
 * 버튼 표면은 1440 실측값이다 — 400×54 / radius 100 / 아이콘 24 + gap 6.
 * 폰(≤767)은 343×48 · 글자 16 이다.
 */
const BUTTON_BASE =
  'flex h-12 w-full items-center justify-center gap-1.5 rounded-[100px] ' +
  'text-[16px] leading-[22px] font-semibold tracking-[-0.4px] transition-opacity ' +
  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:opacity-60 ' +
  'md:h-[54px] md:w-[400px] md:text-[18px] md:leading-[26px] md:tracking-[-0.45px] ' +
  'shadow-[0_0.326px_0.367px_rgba(0,0,0,0.12),0_1.541px_1.433px_rgba(0,0,0,0.07),0_4px_4.5px_rgba(0,0,0,0.05)]'

const GOOGLE_CLASS = `${BUTTON_BASE} border border-[#cdd3db] bg-white text-[#2a2a2a] hover:opacity-90`
const NAVER_CLASS = `${BUTTON_BASE} bg-[#03a94d] text-white hover:opacity-90`

type SocialButton = {
  provider: SocialProvider
  label: string
  icon: ReactNode
  className: string
}

const BUTTONS: readonly SocialButton[] = [
  {
    provider: 'google',
    label: 'Google로 계속하기',
    icon: <GoogleGlyph className="size-6 shrink-0" />,
    className: GOOGLE_CLASS,
  },
  {
    provider: 'naver',
    label: '네이버로 계속하기',
    icon: <NaverGlyph className="size-6 shrink-0" />,
    className: NAVER_CLASS,
  },
]

type LoginFormProps = {
  /** 로그인 후 돌아갈 경로. 서버에서 이미 정규화된 값이다. */
  nextPath: string
  /** `?error=` 로 넘어온 실패 안내. 없으면 오류 행 자체가 없다. */
  initialError?: string
}

/**
 * 로그인 폼 — 버튼 두 개와 그 아래 오류 행 하나가 전부다.
 *
 * 폼 하나에 두 버튼을 담고 눌린 버튼의 `name="provider"` 값으로 제공자를 넘긴다.
 * 스텁/실 OAuth 전환은 서버 액션이 `SOCIAL_LOGIN_MODE` 로 판단하므로 화면은
 * 바뀌지 않는다. 자바스크립트가 없어도 폼 제출은 그대로 동작한다(진행 표시만 빠진다).
 */
export function LoginForm({ nextPath, initialError }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(socialSignIn, EMPTY_FORM_STATE)
  const [clicked, setClicked] = useState<SocialProvider | null>(null)

  /* 액션이 아직 아무것도 돌려주지 않았을 때만 URL 로 받은 오류를 보여 준다.
     새로 시도해 실패했다면 그쪽 문구가 더 정확하다. */
  const error = state === EMPTY_FORM_STATE ? initialError : (state.formError ?? undefined)

  return (
    <form action={formAction} className="flex w-full flex-col items-center">
      {/* 서버 액션은 직접 POST 로도 호출되므로 이 값은 서버에서 다시 정규화된다. */}
      <input type="hidden" name="next" value={nextPath} />

      <div className="flex w-full flex-col items-center gap-4 md:gap-5">
        {BUTTONS.map(({ provider, label, icon, className }) => (
          <button
            key={provider}
            type="submit"
            name="provider"
            value={provider}
            disabled={isPending}
            aria-busy={isPending && clicked === provider}
            onClick={() => setClicked(provider)}
            className={className}
          >
            {icon}
            {isPending && clicked === provider ? '연결 중…' : label}
          </button>
        ))}
      </div>

      {error === undefined ? null : (
        <p
          role="alert"
          className={cn(
            'mt-6 flex items-center justify-center gap-1.5 text-center',
            'text-[14px] leading-[20px] tracking-[-0.35px] text-[#2a2a2a] md:mt-7',
          )}
        >
          <NoticeGlyph className="size-5 shrink-0 md:size-6" />
          {error}
        </p>
      )}
    </form>
  )
}
