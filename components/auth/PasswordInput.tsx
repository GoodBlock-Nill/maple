'use client'

import { useState } from 'react'

import { CancelGlyph, EyeGlyph } from '@/components/auth/auth-icons'
import { AUTH_INPUT_CLASS } from '@/components/auth/auth-styles'
import { cn } from '@/lib/utils/cn'

type PasswordInputProps = {
  id: string
  name: string
  value: string
  onValueChange: (value: string) => void
  placeholder: string
  autoComplete: 'current-password' | 'new-password'
  /** 값이 있을 때 지우기(cancel) 아이콘을 보여 줄지. 시안은 첫 비밀번호 칸에만 둔다. */
  clearable?: boolean
  invalid?: boolean
  describedBy?: string
}

const ICON_BUTTON_CLASS =
  'tap-area flex size-6 shrink-0 items-center justify-center rounded-full transition-opacity ' +
  'hover:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'

/**
 * 비밀번호 입력 — 오른쪽에 눈(표시 전환) + 지우기 아이콘.
 *
 * 시안(2041:2535)의 아이콘 순서는 [눈][10px][지우기] 이고, 지우기가 입력
 * 오른쪽 끝에서 24px 안쪽에 온다. 아이콘 자리는 값이 없을 때도 그대로 비워 둬
 * 타이핑 도중 글자가 밀리지 않게 한다.
 */
export function PasswordInput({
  id,
  name,
  value,
  onValueChange,
  placeholder,
  autoComplete,
  clearable = false,
  invalid = false,
  describedBy,
}: PasswordInputProps) {
  const [isVisible, setIsVisible] = useState(false)
  const showClear = clearable && value !== ''

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={isVisible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={cn(
          AUTH_INPUT_CLASS,
          clearable ? 'pr-[81px]' : 'pr-[57px]',
          invalid && 'border-[#ee1d52]',
          // 시안의 점(●)은 Medium 이다. 실제 값이 있을 때만 굵기를 올린다.
          value !== '' && !isVisible && 'font-medium tracking-[2px]',
        )}
      />

      <div className="absolute inset-y-0 right-[23px] flex items-center gap-[10px]">
        <button
          type="button"
          aria-pressed={isVisible}
          aria-label={isVisible ? '비밀번호 숨기기' : '비밀번호 표시'}
          aria-controls={id}
          onClick={() => setIsVisible((previous) => !previous)}
          className={cn(ICON_BUTTON_CLASS, isVisible && 'opacity-100')}
        >
          <EyeGlyph className={cn('size-6', isVisible ? 'opacity-100' : 'opacity-70')} />
        </button>

        {showClear ? (
          <button
            type="button"
            aria-label="비밀번호 지우기"
            onClick={() => onValueChange('')}
            className={ICON_BUTTON_CLASS}
          >
            <CancelGlyph className="size-6" />
          </button>
        ) : null}
      </div>
    </div>
  )
}
