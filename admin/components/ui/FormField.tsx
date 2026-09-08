'use client'

import { useId } from 'react'

import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

/** 컨트롤이 라벨·설명·오류와 이어지도록 id 를 내려 준다. */
export type FieldRenderProps = {
  controlId: string
  /** `aria-describedby` 에 그대로 넣는다. 힌트·오류가 없으면 undefined. */
  describedBy: string | undefined
  isInvalid: boolean
}

type FormFieldProps = {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (props: FieldRenderProps) => ReactNode
}

/** 입력 컨트롤의 공통 표면. 높이(h-*)는 각 컨트롤이 정한다. */
export const CONTROL_CLASS =
  'w-full rounded-panel border border-line bg-surface px-3 text-[14px] text-ink ' +
  'placeholder:text-muted/70 transition-colors ' +
  'focus:border-accent focus:outline-2 focus:outline-offset-0 focus:outline-accent/40 ' +
  'disabled:cursor-not-allowed disabled:bg-page disabled:text-muted'

export const CONTROL_INVALID_CLASS = 'border-danger focus:border-danger focus:outline-danger/35'

/**
 * 라벨 · 힌트 · 오류를 한 벌로 묶는 폼 필드.
 *
 * id 를 호출부가 직접 짜면 같은 폼에 같은 필드를 두 번 놓았을 때 라벨이 엉뚱한
 * 컨트롤을 가리킨다. `useId()` 로 만들어 내려 주는 이유다.
 */
export function FormField({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FormFieldProps) {
  const controlId = useId()
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const isInvalid = error !== undefined && error !== ''

  const describedBy =
    [hint !== undefined && hint !== '' ? hintId : null, isInvalid ? errorId : null]
      .filter((value): value is string => value !== null)
      .join(' ') || undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label !== undefined && (
        <label htmlFor={controlId} className="text-ink text-[13px] font-semibold">
          {label}
          {required === true && (
            <span className="text-danger ml-0.5" aria-hidden="true">
              *
            </span>
          )}
        </label>
      )}

      {children({ controlId, describedBy, isInvalid })}

      {hint !== undefined && hint !== '' && (
        <p id={hintId} className="text-muted text-[12px]">
          {hint}
        </p>
      )}

      <FormError id={errorId} message={error} />
    </div>
  )
}

/**
 * 폼 오류 문구.
 *
 * `role="alert"` 가 아니라 `aria-live="polite"` 를 쓴다. 서버 액션 응답으로
 * 여러 필드 오류가 한꺼번에 들어올 때 alert 는 스크린 리더가 서로를 끊어 먹는다.
 */
export function FormError({ id, message }: { id?: string; message?: string }) {
  if (message === undefined || message === '') {
    return null
  }

  return (
    <p id={id} aria-live="polite" className="text-danger text-[12px] font-medium">
      {message}
    </p>
  )
}

/** 폼 상단에 그리는 전체 오류 배너. */
export function FormBanner({ message, tone = 'error' }: { message?: string; tone?: 'error' | 'success' }) {
  if (message === undefined || message === '') {
    return null
  }

  return (
    <p
      aria-live="polite"
      className={cn(
        'rounded-panel px-3 py-2.5 text-[13px] font-medium',
        tone === 'error'
          ? 'bg-danger-soft text-danger border-danger/20 border'
          : 'bg-success-soft text-success border-success/20 border',
      )}
    >
      {message}
    </p>
  )
}
