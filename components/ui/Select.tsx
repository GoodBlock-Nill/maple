'use client'

import { Field, FIELD_CONTROL_CLASS, FIELD_INVALID_CLASS } from '@/components/ui/Field'
import { ChevronDownIcon } from '@/components/ui/icons'
import { cn } from '@/lib/utils/cn'

import type { ComponentPropsWithRef } from 'react'

type SelectProps = Omit<ComponentPropsWithRef<'select'>, 'id'> & {
  label?: string
  hint?: string
  error?: string
  wrapperClassName?: string
}

export function Select({
  label,
  hint,
  error,
  className,
  wrapperClassName,
  children,
  ...props
}: SelectProps) {
  return (
    <Field
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      className={wrapperClassName}
    >
      {({ controlId, describedBy, isInvalid }) => (
        <div className="relative">
          <select
            {...props}
            id={controlId}
            aria-describedby={describedBy}
            aria-invalid={isInvalid || undefined}
            className={cn(
              FIELD_CONTROL_CLASS,
              'h-11 cursor-pointer appearance-none pr-10',
              isInvalid && FIELD_INVALID_CLASS,
              className,
            )}
          >
            {children}
          </select>
          <ChevronDownIcon className="text-ink-muted pointer-events-none absolute top-1/2 right-3.5 size-4 -translate-y-1/2" />
        </div>
      )}
    </Field>
  )
}
