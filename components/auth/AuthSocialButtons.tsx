'use client'

import { useActionState, useState } from 'react'

import { GoogleGlyph, KakaoGlyph, NaverGlyph } from '@/components/auth/auth-icons'
import { AUTH_ERROR_CLASS, AUTH_SOCIAL_CLASS } from '@/components/auth/auth-scene-styles'
import { socialSignIn } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { SocialProvider } from '@/lib/validation/auth'
import type { ReactNode } from 'react'

type SocialButton = {
  provider: SocialProvider
  label: string
  icon: ReactNode
}

/* 아이콘 크기는 시안 실측값이다(구글 24 · 카카오 28 · 네이버 28). */
const BUTTONS: readonly SocialButton[] = [
  { provider: 'google', label: 'Google로 계속하기', icon: <GoogleGlyph className="size-6" /> },
  { provider: 'kakao', label: 'Kakao로 계속하기', icon: <KakaoGlyph className="size-7" /> },
  { provider: 'naver', label: 'Naver로 계속하기', icon: <NaverGlyph className="size-7" /> },
]

type AuthSocialButtonsProps = {
  /** 로그인 후 돌아갈 경로. 서버에서 다시 정규화된다. */
  nextPath: string
  /** 인증 라우트 핸들러가 `?error=` 로 넘긴 실패 안내. */
  initialError?: string
}

/**
 * 간편로그인 버튼 3개(시안 580×64 어두운 pill).
 *
 * 폼 하나에 세 버튼을 담고 눌린 버튼의
 * `name="provider"` 값으로 제공자를 넘긴다. 스텁/실 OAuth 전환은 서버 액션이
 * `SOCIAL_LOGIN_MODE` 로 판단하므로 화면은 바뀌지 않는다.
 *
 * 자바스크립트가 없어도 폼 제출은 그대로 동작한다(진행 표시만 빠진다).
 */
export function AuthSocialButtons({ nextPath, initialError }: AuthSocialButtonsProps) {
  const [state, formAction, isPending] = useActionState(socialSignIn, EMPTY_FORM_STATE)
  const [clicked, setClicked] = useState<SocialProvider | null>(null)

  /* 액션이 아직 아무것도 돌려주지 않았을 때만 URL 로 받은 오류를 보여 준다.
     새로 시도해 실패했다면 그쪽 문구가 더 정확하다. */
  const error = state === EMPTY_FORM_STATE ? initialError : (state.formError ?? undefined)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/* 서버 액션은 직접 POST 로도 호출되므로 이 값은 서버에서 다시 정규화된다. */}
      <input type="hidden" name="next" value={nextPath} />

      {error === undefined ? null : (
        <p role="alert" className={`${AUTH_ERROR_CLASS} mt-0 text-center`}>
          {error}
        </p>
      )}

      {BUTTONS.map(({ provider, label, icon }) => (
        <button
          key={provider}
          type="submit"
          name="provider"
          value={provider}
          disabled={isPending}
          aria-busy={isPending && clicked === provider}
          onClick={() => setClicked(provider)}
          className={AUTH_SOCIAL_CLASS}
        >
          {icon}
          {isPending && clicked === provider ? '연결 중…' : label}
        </button>
      ))}
    </form>
  )
}
