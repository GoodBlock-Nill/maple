'use client'

import { useActionState, useState } from 'react'

import { MarketingConsentDialog } from '@/components/auth/MarketingConsentDialog'
import {
  ONBOARDING_CARD_CLASS,
  ONBOARDING_PAGE_CLASS,
  ONBOARDING_SUBMIT_CLASS,
} from '@/components/auth/onboarding-styles'
import { OnboardingConsents } from '@/components/auth/OnboardingConsents'
import { OnboardingFailureCard } from '@/components/auth/OnboardingFailureCard'
import { OnboardingMswFields } from '@/components/auth/OnboardingMswFields'
import { OnboardingNickname } from '@/components/auth/OnboardingNickname'
import { completeOnboarding } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { ONBOARDING_COPY } from '@/lib/content/onboarding'
import { cn } from '@/lib/utils/cn'
import { nicknameIssue } from '@/lib/validation/auth'

import type { ConsentValues } from '@/components/auth/OnboardingConsents'
import type { MswFieldValues } from '@/components/auth/OnboardingMswFields'
import type { FormState } from '@/lib/actions/form-state'

type OnboardingFormProps = {
  /** 온보딩 후 돌아갈 경로. 서버에서 이미 정규화된 값이다. */
  nextPath: string
  /** 제공자에서 받아 온 임시 닉네임. 사용자가 그대로 확정할 수도 있다. */
  defaultNickname: string
  /** 재방문(입력을 마치지 못하고 이탈했다가 돌아온) 시 이미 입력해 둔 값. */
  defaultMswUid: string
  defaultMswProfileCode: string
  /** 마케팅 수신 안내 본문(발행본 또는 코드 문안). 서버가 골라서 넘긴다. */
  marketingConsentHtml: string
}

const NO_CONSENTS: ConsentValues = {
  termsAgreed: false,
  privacyAgreed: false,
  marketingAgreed: false,
  ageConfirmed: false,
}

/**
 * 회원가입(온보딩) 카드 — 시안 auth-v2 27:5172.
 *
 * 입력값을 **모두 리액트 상태로** 들고 있다. 이유가 둘이다.
 *  1) 버튼 활성 조건(필수 약관·만 14세·닉네임 검증)을 입력할 때마다 판정해야 한다.
 *  2) 실패 카드(27:5161)로 갈아탈 때 폼이 언마운트되는데, 되돌아오면 값이 그대로여야 한다.
 *
 * 만 14세 확인은 개인정보처리방침 제11조(만 14세 미만 가입 불가) 때문에 필수다.
 * 마케팅 동의만 선택이며, 체크하지 않으면 두 수신거부 컬럼이 켜진 채 저장된다.
 */
export function OnboardingForm({
  nextPath,
  defaultNickname,
  defaultMswUid,
  defaultMswProfileCode,
  marketingConsentHtml,
}: OnboardingFormProps) {
  const [state, formAction, isPending] = useActionState(completeOnboarding, EMPTY_FORM_STATE)
  const [nickname, setNickname] = useState(defaultNickname)
  const [msw, setMsw] = useState<MswFieldValues>({
    mswUid: defaultMswUid,
    mswProfileCode: defaultMswProfileCode,
  })
  const [consents, setConsents] = useState<ConsentValues>(NO_CONSENTS)
  const [isMarketingOpen, setMarketingOpen] = useState(false)
  /** 마지막으로 제출한 닉네임. 값을 고치면 서버가 준 오류를 내린다. */
  const [submittedNickname, setSubmittedNickname] = useState<string | null>(null)
  /** "다시 시도하기"로 닫은 실패 상태. 액션이 새로 실패하면 다른 객체라 다시 열린다. */
  const [dismissedFailure, setDismissedFailure] = useState<FormState | null>(null)

  const issue = nicknameIssue(nickname)
  const serverNicknameError =
    submittedNickname === nickname ? state.fieldErrors?.nickname : undefined
  const nicknameError = issue === 'charset' ? ONBOARDING_COPY.nicknameInvalid : serverNicknameError

  if (state.formError !== undefined && state !== dismissedFailure) {
    return <OnboardingFailureCard onRetry={() => setDismissedFailure(state)} />
  }

  const isDisabled =
    isPending ||
    issue !== null ||
    !consents.termsAgreed ||
    !consents.privacyAgreed ||
    !consents.ageConfirmed

  return (
    <div className={ONBOARDING_PAGE_CLASS}>
      <section className={ONBOARDING_CARD_CLASS}>
        <form action={formAction} onSubmit={() => setSubmittedNickname(nickname)}>
          {/* 서버 액션은 직접 POST 로도 호출되므로 이 값은 서버에서 다시 정규화된다. */}
          <input type="hidden" name="next" value={nextPath} />

          <div className="text-center">
            <h1 className="text-[20px] leading-[28px] font-medium tracking-[-0.5px] text-[#2a2a2a] md:text-[32px] md:leading-[42px] md:tracking-[-0.8px]">
              {ONBOARDING_COPY.title}
            </h1>
            <p className="mt-2 text-[14px] leading-[20px] font-medium tracking-[-0.35px] text-[#727272] md:text-[16px] md:leading-[22px] md:tracking-[-0.4px]">
              {ONBOARDING_COPY.subtitle}
            </p>
          </div>

          <div className="mt-6 md:mt-8">
            <OnboardingNickname value={nickname} onChange={setNickname} error={nicknameError} />
          </div>

          <OnboardingMswFields
            values={msw}
            onChange={setMsw}
            errors={{
              mswUid: state.fieldErrors?.mswUid,
              mswProfileCode: state.fieldErrors?.mswProfileCode,
            }}
          />

          <div className="mt-6 md:mt-8">
            <OnboardingConsents
              values={consents}
              onToggle={(name, checked) =>
                setConsents((current) => ({ ...current, [name]: checked }))
              }
              onToggleAll={(checked) =>
                setConsents({
                  termsAgreed: checked,
                  privacyAgreed: checked,
                  marketingAgreed: checked,
                  ageConfirmed: checked,
                })
              }
              onOpenMarketing={() => setMarketingOpen(true)}
            />
          </div>

          <button
            type="submit"
            disabled={isDisabled}
            aria-busy={isPending}
            className={cn(ONBOARDING_SUBMIT_CLASS, 'mt-7 md:mt-8')}
          >
            {isPending ? ONBOARDING_COPY.submitPending : ONBOARDING_COPY.submit}
          </button>
        </form>
      </section>

      <MarketingConsentDialog
        open={isMarketingOpen}
        onClose={() => setMarketingOpen(false)}
        onAgree={() => {
          setConsents((current) => ({ ...current, marketingAgreed: true }))
          setMarketingOpen(false)
        }}
        html={marketingConsentHtml}
      />
    </div>
  )
}
