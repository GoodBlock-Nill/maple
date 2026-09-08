'use client'

import { Field, FIELD_CONTROL_CLASS, FIELD_INVALID_CLASS } from '@/components/ui/Field'
import { cn } from '@/lib/utils/cn'

import type { ComponentPropsWithRef } from 'react'

const DEFAULT_ROWS = 5

type TextareaProps = Omit<ComponentPropsWithRef<'textarea'>, 'id'> & {
  label?: string
  hint?: string
  error?: string
  wrapperClassName?: string
}

export function Textarea({
  label,
  hint,
  error,
  className,
  wrapperClassName,
  rows = DEFAULT_ROWS,
  ...props
}: TextareaProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      className={wrapperClassName}
    >
      {({ controlId, describedBy, isInvalid }) => (
        <textarea
          {...props}
          rows={rows}
          id={controlId}
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          className={cn(
            FIELD_CONTROL_CLASS,
            'resize-y py-3 leading-relaxed',
            isInvalid && FIELD_INVALID_CLASS,
            className,
          )}
        />
      )}
    </Field>
  )
}
