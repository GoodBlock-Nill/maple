'use client'

import { CONTROL_CLASS, CONTROL_INVALID_CLASS, FormField } from '@/components/ui/FormField'
import { cn } from '@/lib/utils/cn'

import type { ComponentPropsWithRef } from 'react'

export type SelectOption = {
  value: string
  label: string
}

type SelectProps = Omit<ComponentPropsWithRef<'select'>, 'id' | 'children'> & {
  label?: string
  hint?: string
  error?: string
  options: readonly SelectOption[]
  /** 값이 비었을 때 보여 줄 첫 항목. 지정하지 않으면 넣지 않는다. */
  placeholder?: string
  wrapperClassName?: string
}

export function Select({
  label,
  hint,
  error,
  options,
  placeholder,
  className,
  wrapperClassName,
  ...props
}: SelectProps) {
  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      className={wrapperClassName}
    >
      {({ controlId, describedBy, isInvalid }) => (
        <select
          {...props}
          id={controlId}
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          className={cn(
            CONTROL_CLASS,
            'h-10 appearance-none bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9',
            isInvalid && CONTROL_INVALID_CLASS,
            className,
          )}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      )}
    </FormField>
  )
}
