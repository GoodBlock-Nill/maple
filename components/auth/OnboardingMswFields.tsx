'use client'

import { useId } from 'react'

import {
  ONBOARDING_HINT_CLASS,
  ONBOARDING_INPUT_CLASS,
  ONBOARDING_LABEL_CLASS,
} from '@/components/auth/onboarding-styles'
import { FEATURES } from '@/lib/constants/features'
import { cn } from '@/lib/utils/cn'

export type MswFieldValues = {
  mswUid: string
  mswProfileCode: string
}

type OnboardingMswFieldsProps = {
  values: MswFieldValues
  onChange: (values: MswFieldValues) => void
  errors: Partial<Record<keyof MswFieldValues, string>>
}

type FieldConfig = {
  name: keyof MswFieldValues
  label: string
  placeholder: string
  hint: string
  inputMode?: 'numeric'
}

const FIELDS: readonly FieldConfig[] = [
  {
    name: 'mswUid',
    label: '메이플스토리 월드 계정 UID',
    placeholder: '예: 20123000000000000',
    hint: 'UID는 "클라이언트 - 설정 - 계정" 에서 확인할 수 있어요.',
    inputMode: 'numeric',
  },
  {
    name: 'mswProfileCode',
    label: '메이플스토리 월드 프로필 코드',
    placeholder: '예: #abcd1',
    hint: '프로필 코드는 "클라이언트 - 더보기 - 프로필 편집" 에서 확인할 수 있어요.',
  },
]

/**
 * 메이플스토리 월드 계정 입력 — **플래그가 켜졌을 때만** 그린다.
 *
 * 회원가입 v2 시안에는 이 두 칸이 없다. 그래도 지우지 않는 이유: 스키마
 * (`onboardingSchema`)가 플래그가 켜지는 순간 두 값을 필수로 요구하므로, 입력칸이
 * 없으면 아무도 온보딩을 통과하지 못한다. 표면은 닉네임과 같은 v2 입력을 쓴다.
 */
export function OnboardingMswFields({ values, onChange, errors }: OnboardingMswFieldsProps) {
  const reactId = useId()

  if (!FEATURES.mswAccountFields) {
    return null
  }

  return (
    <>
      {FIELDS.map((field) => {
        const inputId = `${field.name}${reactId}`
        const hintId = `${inputId}-hint`
        const error = errors[field.name]

        return (
          <div key={field.name} className="mt-6 md:mt-8">
            <label htmlFor={inputId} className={ONBOARDING_LABEL_CLASS}>
              {field.label}
            </label>

            <input
              id={inputId}
              name={field.name}
              type="text"
              inputMode={field.inputMode}
              value={values[field.name]}
              onChange={(event) => onChange({ ...values, [field.name]: event.target.value })}
              placeholder={field.placeholder}
              aria-describedby={hintId}
              aria-invalid={error === undefined ? undefined : true}
              className={cn(
                ONBOARDING_INPUT_CLASS,
                'mt-2 pr-4',
                error === undefined ? 'border-[#cdd3db] focus:border-[#111]' : 'border-[#852221]',
              )}
            />

            <p
              id={hintId}
              role={error === undefined ? undefined : 'alert'}
              className={cn(
                ONBOARDING_HINT_CLASS,
                error === undefined ? 'text-[#727272]' : 'text-[#852221]',
              )}
            >
              {error ?? field.hint}
            </p>
          </div>
        )
      })}
    </>
  )
}
