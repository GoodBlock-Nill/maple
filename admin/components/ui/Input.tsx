'use client'

import { toCountableText, useInputLength } from '@/components/ui/CharacterCount'
import { CONTROL_CLASS, CONTROL_INVALID_CLASS, FormField } from '@/components/ui/FormField'
import { cn } from '@/lib/utils/cn'

import type { ComponentPropsWithRef } from 'react'

/**
 * 글자수를 기본으로 표시하는 입력 유형.
 *
 * `password` 는 뺀다 — 화면에 남는 숫자로 어깨너머에 비밀번호 길이가 읽힌다.
 * 상한은 힌트 문장으로 적는다. 날짜 · 숫자 · 파일 · 체크 계열은 브라우저가
 * `maxLength` 를 아예 적용하지 않는 유형이라 셀 것이 없다.
 */
const COUNTABLE_TYPES: ReadonlySet<string> = new Set(['text', 'search', 'url', 'tel', 'email'])

/* `ref` 를 빼는 이유: 글자수를 세려면 컴포넌트가 DOM 노드를 직접 잡아야 한다.
   호출부 ref 와 합치려면 남의 ref 객체를 대신 써야 해서(react-hooks/immutability)
   타입에서 먼저 막는다. 지금 관리자 화면에는 컨트롤에 ref 를 거는 호출부가 없다. */
type InputProps = Omit<ComponentPropsWithRef<'input'>, 'id' | 'ref'> & {
  label?: string
  hint?: string
  error?: string
  /** 필드 래퍼(라벨/오류 포함)에 적용할 클래스. */
  wrapperClassName?: string
  /** 글자수 표시. 기본값은 `maxLength` 가 있고 셀 수 있는 유형일 때 true. */
  showCount?: boolean
  /** 필터 막대처럼 필드 높이를 늘릴 수 없는 자리에서는 `label` 을 쓴다. */
  countPlacement?: 'hint' | 'label'
}

export function Input({
  label,
  hint,
  error,
  className,
  wrapperClassName,
  showCount,
  countPlacement,
  ...props
}: InputProps) {
  const isControlled = props.value !== undefined
  const { count, register } = useInputLength(
    toCountableText(isControlled ? props.value : props.defaultValue),
    isControlled,
  )
  const isCounting = showCount ?? COUNTABLE_TYPES.has(props.type ?? 'text')
  const fieldCount =
    props.maxLength !== undefined && isCounting ? { value: count, max: props.maxLength } : undefined

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
        <input
          {...props}
          ref={fieldCount === undefined ? undefined : register}
          id={controlId}
          aria-describedby={describedBy}
          aria-invalid={isInvalid || undefined}
          className={cn(CONTROL_CLASS, 'h-10', isInvalid && CONTROL_INVALID_CLASS, className)}
        />
      )}
    </FormField>
  )
}
