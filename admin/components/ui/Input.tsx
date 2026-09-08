'use client'

import { CONTROL_CLASS, CONTROL_INVALID_CLASS, FormField } from '@/components/ui/FormField'
import { cn } from '@/lib/utils/cn'

import type { ComponentPropsWithRef } from 'react'

type InputProps = Omit<ComponentPropsWithRef<'input'>, 'id'> & {
  label?: string
  hint?: string
  error?: string
  /** 필드 래퍼(라벨/오류 포함)에 적용할 클래스. */
  wrapperClassName?: string
}

export function Input({ label, hint, error, className, wrapperClassName, ...props }: InputProps) {
  return (
    <FormField
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
          className={cn(CONTROL_CLASS, 'h-10', isInvalid && CONTROL_INVALID_CLASS, className)}
        />
      )}
    </FormField>
  )
}
