'use client'

import { useId } from 'react'

import { ClearGlyph } from '@/components/auth/auth-icons'
import {
  ONBOARDING_HINT_CLASS,
  ONBOARDING_INPUT_CLASS,
  ONBOARDING_LABEL_CLASS,
} from '@/components/auth/onboarding-styles'
import { ONBOARDING_COPY } from '@/lib/content/onboarding'
import { cn } from '@/lib/utils/cn'
import { NICKNAME_MAX_LENGTH } from '@/lib/validation/auth'

type OnboardingNicknameProps = {
  value: string
  onChange: (value: string) => void
  /** 있으면 테두리·도움말이 빨간색(#852221)으로 바뀐다. */
  error?: string
}

/**
 * 닉네임 입력 한 벌 — 라벨 · 입력 · 지우기 · 도움말(시안 §닉네임).
 *
 * 테두리는 세 가지다. 비었을 때 #cdd3db, 입력 중/완료 #111, 오류 #852221.
 * "입력 중"을 포커스가 아니라 **값이 있는지**로 잡는다 — 시안의 Input_Typing 과
 * Input_Filled 표면이 같고, 포커스를 잃어도 검은 테두리가 남는다.
 *
 * 도움말은 한 줄을 늘 차지한다(비어 있을 때 규칙, 입력 후 짧은 문구, 오류 시 사유).
 * 자리를 비우면 오류가 뜰 때 아래 약관 블록이 통째로 밀린다.
 */
export function OnboardingNickname({ value, onChange, error }: OnboardingNicknameProps) {
  const reactId = useId()
  const inputId = `nickname${reactId}`
  const hintId = `${inputId}-hint`
  const hasError = error !== undefined

  const borderClass = hasError
    ? 'border-[#852221]'
    : value === ''
      ? 'border-[#cdd3db] focus:border-[#111]'
      : 'border-[#111]'

  const hint = value === '' ? ONBOARDING_COPY.nicknameHint : ONBOARDING_COPY.nicknameHintTyping

  return (
    <div>
      <label htmlFor={inputId} className={ONBOARDING_LABEL_CLASS}>
        {ONBOARDING_COPY.nicknameLabel}
      </label>

      <div className="relative mt-2">
        <input
          id={inputId}
          name="nickname"
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={NICKNAME_MAX_LENGTH}
          autoComplete="nickname"
          placeholder={ONBOARDING_COPY.nicknamePlaceholder}
          aria-describedby={hintId}
          aria-invalid={hasError || undefined}
          className={cn(ONBOARDING_INPUT_CLASS, borderClass)}
        />

        {value === '' ? null : (
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label={ONBOARDING_COPY.nicknameClear}
            className="focus-visible:outline-focus absolute top-1/2 right-4 -translate-y-1/2 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ClearGlyph className="size-5" />
          </button>
        )}
      </div>

      <p
        id={hintId}
        role={hasError ? 'alert' : undefined}
        className={cn(ONBOARDING_HINT_CLASS, hasError ? 'text-[#852221]' : 'text-[#727272]')}
      >
        {error ?? hint}
      </p>
    </div>
  )
}
