'use client'

import { useId } from 'react'

import { cn } from '@/lib/utils/cn'

import type { ReactNode } from 'react'

/** Input/Textarea/Select가 공유하는 컨트롤 표면. */
export const FIELD_CONTROL_CLASS =
  'w-full rounded-card border border-line bg-surface px-4 text-input-sm text-ink ' +
  'placeholder:text-ink-muted/70 transition-colors duration-150 ' +
  'hover:border-ink-muted/40 focus-visible:border-focus focus-visible:outline-2 ' +
  'focus-visible:outline-offset-0 focus-visible:outline-focus ' +
  'disabled:cursor-not-allowed disabled:bg-sheet disabled:text-ink-muted'

export const FIELD_INVALID_CLASS = 'border-badge-red focus-visible:outline-badge-red'

type FieldRenderArgs = {
  controlId: string
  describedBy: string | undefined
  isInvalid: boolean
}

type FieldProps = {
  label?: string
  hint?: string
  error?: string
  required?: boolean
  className?: string
  children: (args: FieldRenderArgs) => ReactNode
}

export function Field({ label, hint, error, required, className, children }: FieldProps) {
  const reactId = useId()
  const controlId = `field${reactId}`
  const hintId = `${controlId}-hint`
  const errorId = `${controlId}-error`
  const isInvalid = Boolean(error)

  const describedByParts = [hint ? hintId : null, error ? errorId : null].filter(Boolean)
  const describedBy = describedByParts.length > 0 ? describedByParts.join(' ') : undefined

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      {label ? (
        <label htmlFor={controlId} className="text-ink text-[13px] font-bold">
          {label}
          {required ? (
            <span className="text-badge-red ml-1" aria-hidden>
              *
            </span>
          ) : null}
        </label>
      ) : null}

      {children({ controlId, describedBy, isInvalid })}

      {hint && !error ? (
        <p id={hintId} className="text-ink-muted text-[12px]">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" className="text-badge-red text-[12px] font-medium">
          {error}
        </p>
      ) : null}
    </div>
  )
}
