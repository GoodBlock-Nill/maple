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
  /**
   * 필수 항목 표시.
   *
   * 별표는 **눈으로 보는 표시**라 `aria-hidden` 이다 — 필수 여부는 컨트롤의
   * `required` 속성이 이미 읽어 준다. 라벨에 "(필수)" 를 덧붙이면 접근성 이름이
   * 화면 문구와 갈려서, 스크린 리더 사용자와 눈으로 보는 사용자가 서로 다른 이름을
   * 부르게 된다.
   */
  required?: boolean
  /** 입력 아래 한 줄 안내(계정 ID 확인 방법 등). */
  hint?: string
  children: ReactNode
}

/** 라벨 + 필드 + 안내 + 오류 한 묶음. 시안의 라벨-필드 간격 8 을 지킨다. */
export function FormRow({ label, htmlFor, error, required, hint, children }: FormRowProps) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={htmlFor} className={SUPPORT_LABEL_CLASS}>
        {label}
        {required === true && (
          <span aria-hidden className="text-badge-red ml-1">
            *
          </span>
        )}
      </label>
      {children}
      {hint === undefined ? null : (
        <p id={`${htmlFor}-hint`} className="text-ink-muted text-[14px] leading-[1.5]">
          {hint}
        </p>
      )}
      <FieldError message={error} />
    </div>
  )
}
