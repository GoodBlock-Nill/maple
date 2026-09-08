'use client'

import { CONTROL_CLASS, CONTROL_INVALID_CLASS, FormField } from '@/components/ui/FormField'
import { cn } from '@/lib/utils/cn'

import type { ComponentPropsWithRef } from 'react'

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
  rows = 4,
  ...props
}: TextareaProps) {
  return (
    <FormField
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
            CONTROL_CLASS,
            'resize-y py-2.5 leading-relaxed',
            isInvalid && CONTROL_INVALID_CLASS,
            className,
          )}
        />
      )}
    </FormField>
  )
}
