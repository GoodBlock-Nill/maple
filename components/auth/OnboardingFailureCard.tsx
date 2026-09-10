'use client'

import {
  ONBOARDING_FAILURE_CARD_CLASS,
  ONBOARDING_FAILURE_PAGE_CLASS,
  ONBOARDING_PRIMARY_BUTTON_CLASS,
  ONBOARDING_SECONDARY_BUTTON_CLASS,
} from '@/components/auth/onboarding-styles'
import { signOutToLogin } from '@/lib/actions/auth-actions'
import { ONBOARDING_COPY } from '@/lib/content/onboarding'

type OnboardingFailureCardProps = {
  /** 입력값을 그대로 둔 채 폼으로 되돌아간다. */
  onRetry: () => void
}

/**
 * 회원가입 실패 카드(시안 27:5161 · 27:5337).
 *
 * DB 오류처럼 사용자가 고칠 수 없는 실패에서만 나온다. 닉네임 중복·형식 오류 같은
 * 검증 실패는 폼 안에 그대로 남는다 — 화면을 통째로 바꾸면 어디를 고쳐야 하는지
 * 알 수 없다.
 *
 * "로그인으로 돌아가기"는 링크가 아니라 폼(POST)이다. 온보딩을 마치지 못한 세션을
 * 끊어야 하는데, GET 로그아웃은 프리페치만으로도 세션이 끊기는 표면이 된다.
 */
export function OnboardingFailureCard({ onRetry }: OnboardingFailureCardProps) {
  return (
    <div className={ONBOARDING_FAILURE_PAGE_CLASS}>
      <section className={ONBOARDING_FAILURE_CARD_CLASS}>
        <h1 className="text-center text-[20px] leading-[28px] font-medium tracking-[-0.5px] text-[#2a2a2a] md:text-[32px] md:leading-[42px] md:tracking-[-0.8px]">
          {ONBOARDING_COPY.failureTitle}
        </h1>

        <p
          role="alert"
          className="mt-2 text-center text-[14px] leading-[20px] font-medium tracking-[-0.35px] text-[#727272] md:text-[16px] md:leading-[22px] md:tracking-[-0.4px]"
        >
          {ONBOARDING_COPY.failureBody.map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
        </p>

        <div className="mt-8 flex flex-col gap-4 md:gap-5">
          <button type="button" onClick={onRetry} className={ONBOARDING_PRIMARY_BUTTON_CLASS}>
            {ONBOARDING_COPY.retry}
          </button>

          <form action={signOutToLogin}>
            <button type="submit" className={ONBOARDING_SECONDARY_BUTTON_CLASS}>
              {ONBOARDING_COPY.backToLogin}
            </button>
          </form>
        </div>
      </section>
    </div>
  )
}
