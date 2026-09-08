'use client'

import { Field, FIELD_CONTROL_CLASS, FIELD_INVALID_CLASS } from '@/components/ui/Field'
import { cn } from '@/lib/utils/cn'

import type { ComponentPropsWithRef } from 'react'

type InputProps = Omit<ComponentPropsWithRef<'input'>, 'id'> & {
  label?: string
  hint?: string
  error?: string
  /** 필드 래퍼(라벨/에러 포함)에 적용할 클래스. */
  wrapperClassName?: string
}

export function Input({ label, hint, error, className, wrapperClassName, ...props }: InputProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      className={wrapperClassName}
    >
      {({ controlId, describedBy, isInvalid }) => (
        <input
          {...props}
          id={controlId}
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          className={cn(FIELD_CONTROL_CLASS, 'h-11', isInvalid && FIELD_INVALID_CLASS, className)}
        />
      )}
    </Field>
  )
}
