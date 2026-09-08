'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { AUTH_FIELD_CLASS, AUTH_LINK_CLASS } from '@/components/auth/auth-styles'
import { FormFeedback } from '@/components/auth/FormFeedback'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { Input } from '@/components/ui/Input'
import { completeOnboarding } from '@/lib/actions/auth-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { NICKNAME_MAX_LENGTH, NICKNAME_MIN_LENGTH } from '@/lib/validation/auth'

import type { ReactNode } from 'react'

type OnboardingFormProps = {
  /** 온보딩 후 돌아갈 경로. 서버에서 이미 정규화된 값이다. */
  nextPath: string
  /** 제공자에서 받아 온 임시 닉네임. 사용자가 그대로 확정할 수도 있다. */
  defaultNickname: string
}

type ConsentProps = {
  name: string
  error: string | undefined
  children: ReactNode
}

/**
 * 필수 동의 한 줄.
 *
 * 체크박스는 체크했을 때만 FormData 에 담긴다. 서버 액션은 "값이 있는지"만 보고
 * 판단하므로 value 를 따로 주지 않는다.
 */
function Consent({ name, error, children }: ConsentProps) {
  const errorId = `${name}-error`

  return (
    <div className="flex flex-col gap-1">
      <label className="text-ink flex items-start gap-2.5 text-[15px] leading-[1.5]">
        <input
          type="checkbox"
          name={name}
          aria-describedby={error === undefined ? undefined : errorId}
          aria-invalid={error === undefined ? undefined : true}
          className="accent-ink mt-0.5 h-[18px] w-[18px] shrink-0"
        />
        <span>{children}</span>
      </label>
      {error === undefined ? null : (
        <p id={errorId} role="alert" className="text-badge-red pl-7 text-[12px] font-medium">
          {error}
        </p>
      )}
    </div>
  )
}

/**
 * 최초 로그인 온보딩.
 *
 * 닉네임 확정과 필수 동의 세 가지를 한 화면에서 받는다. 만 14세 확인은
 * 개인정보처리방침 제11조(만 14세 미만 가입 불가) 때문에 선택이 아니라 필수다.
 */
export function OnboardingForm({ nextPath, defaultNickname }: OnboardingFormProps) {
  const [state, formAction] = useActionState(completeOnboarding, EMPTY_FORM_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <FormFeedback state={state} />

      <input type="hidden" name="next" value={nextPath} />

      <Input
        label="닉네임"
        name="nickname"
        type="text"
        required
        defaultValue={defaultNickname}
        minLength={NICKNAME_MIN_LENGTH}
        maxLength={NICKNAME_MAX_LENGTH}
        autoComplete="nickname"
        placeholder={`${NICKNAME_MIN_LENGTH}~${NICKNAME_MAX_LENGTH}자`}
        hint="한글·영문·숫자·밑줄만 쓸 수 있고, 게시판에는 앞 3글자만 노출됩니다."
        error={state.fieldErrors?.nickname}
        className={AUTH_FIELD_CLASS}
      />

      <fieldset className="flex flex-col gap-3">
        <legend className="text-ink mb-1 text-[13px] font-bold">
          필수 동의
          <span className="text-badge-red ml-1" aria-hidden>
            *
          </span>
        </legend>

        <Consent name="termsAgreed" error={state.fieldErrors?.termsAgreed}>
          <Link href="/policy/operating" className={AUTH_LINK_CLASS} target="_blank">
            이용약관
          </Link>
          에 동의합니다.
        </Consent>

        <Consent name="privacyAgreed" error={state.fieldErrors?.privacyAgreed}>
          <Link href="/policy/privacy" className={AUTH_LINK_CLASS} target="_blank">
            개인정보처리방침
          </Link>
          에 동의합니다.
        </Consent>

        <Consent name="ageConfirmed" error={state.fieldErrors?.ageConfirmed}>
          만 14세 이상입니다.
        </Consent>
      </fieldset>

      <SubmitButton pendingLabel="저장 중…">시작하기</SubmitButton>
    </form>
  )
}
