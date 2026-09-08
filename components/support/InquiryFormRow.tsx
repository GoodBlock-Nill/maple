import { SUPPORT_LABEL_CLASS } from '@/components/support/support-styles'

import type { ReactNode } from 'react'

type FieldErrorProps = {
  message: string | undefined
}

/**
 * 필드 오류 한 줄.
 *
 * `role="alert"` 이라 제출 직후 스크린 리더가 읽는다. 색만으로 구분하지 않도록
 * 문구 자체가 무엇을 고쳐야 하는지 말한다.
 */
export function FieldError({ message }: FieldErrorProps) {
  if (message === undefined) {
    return null
  }

  return (
    <p role="alert" className="text-badge-red text-[15px] font-medium">
      {message}
    </p>
  )
}

type FormRowProps = {
  label: string
  htmlFor: string
  error?: string
  children: ReactNode
}

/** 라벨 + 필드 + 오류 한 묶음. 시안의 라벨-필드 간격 8 을 지킨다. */
export function FormRow({ label, htmlFor, error, children }: FormRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className={SUPPORT_LABEL_CLASS}>
        {label}
      </label>
      {children}
      <FieldError message={error} />
    </div>
  )
}
