'use client'

import { toCountableText, useInputLength } from '@/components/ui/CharacterCount'
import { CONTROL_CLASS, CONTROL_INVALID_CLASS, FormField } from '@/components/ui/FormField'
import { cn } from '@/lib/utils/cn'

import type { ComponentPropsWithRef } from 'react'

/** `ref` 를 빼는 까닭은 Input 과 같다 — 글자수 측정용으로 컴포넌트가 쓴다. */
type TextareaProps = Omit<ComponentPropsWithRef<'textarea'>, 'id' | 'ref'> & {
  label?: string
  hint?: string
  error?: string
  wrapperClassName?: string
  /** 글자수 표시. 기본값은 `maxLength` 가 있을 때 true. */
  showCount?: boolean
  countPlacement?: 'hint' | 'label'
}

export function Textarea({
  label,
  hint,
  error,
  className,
  wrapperClassName,
  showCount = true,
  countPlacement,
  rows = 4,
  ...props
}: TextareaProps) {
  const isControlled = props.value !== undefined
  const { count, register } = useInputLength(
    toCountableText(isControlled ? props.value : props.defaultValue),
    isControlled,
  )
  const fieldCount =
    props.maxLength !== undefined && showCount ? { value: count, max: props.maxLength } : undefined

  return (
    <FormField
      label={label}
      hint={hint}
      error={error}
      required={props.required}
      className={wrapperClassName}
      count={fieldCount}
      countPlacement={countPlacement}
    >
      {({ controlId, describedBy, isInvalid }) => (
        <textarea
          {...props}
          ref={fieldCount === undefined ? undefined : register}
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
