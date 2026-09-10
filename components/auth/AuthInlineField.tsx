'use client'

import { AuthField } from '@/components/auth/AuthField'
import { AUTH_INLINE_BUTTON_CLASS, AUTH_INPUT_CLASS } from '@/components/auth/auth-scene-styles'
import { cn } from '@/lib/utils/cn'

import type { InputHTMLAttributes } from 'react'

type InlineAction = {
  label: string
  disabled: boolean
  onClick: () => void
  /** 시안의 두 버튼은 배경색만 다르다(#2a2a2a 전송 / #111 인증하기). */
  className: string
}

type AuthInlineFieldProps = {
  id: string
  label: string
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  action: InlineAction
  error?: string
  notice?: string | null
  readOnly?: boolean
  className?: string
  inputProps?: Pick<
    InputHTMLAttributes<HTMLInputElement>,
    'type' | 'inputMode' | 'autoComplete' | 'maxLength' | 'name'
  >
}

/**
 * 회원가입 시안의 "입력 435 + 버튼 135" 한 줄.
 *
 * 두 줄(이메일 · 인증번호)이 구조가 같아서 한 컴포넌트로 둔다. 폰에서는 입력이
 * 남은 폭을 모두 쓰고 버튼만 120px 로 고정된다.
 */
export function AuthInlineField({
  id,
  label,
  value,
  onValueChange,
  placeholder,
  action,
  error,
  notice,
  readOnly = false,
  className,
  inputProps,
}: AuthInlineFieldProps) {
  return (
    <AuthField label={label} htmlFor={id} error={error} notice={notice} className={className}>
      <div className="flex gap-[10px]">
        <input
          {...inputProps}
          id={id}
          value={value}
          readOnly={readOnly}
          placeholder={placeholder}
          onChange={(event) => onValueChange(event.target.value)}
          aria-invalid={error === undefined ? undefined : true}
          className={cn(AUTH_INPUT_CLASS, 'pr-[23px]', error !== undefined && 'border-[#ee1d52]')}
        />
        <button
          type="button"
          disabled={action.disabled}
          onClick={action.onClick}
          className={cn(AUTH_INLINE_BUTTON_CLASS, action.className)}
        >
          {action.label}
        </button>
      </div>
    </AuthField>
  )
}
