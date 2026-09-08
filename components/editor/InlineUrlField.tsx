'use client'

import { useId, useState } from 'react'

/**
 * 툴바 아래에 펼쳐지는 URL 입력 줄(링크 · 영상 공용).
 *
 * `window.prompt` 를 쓰지 않는다. 프롬프트는 스타일을 못 입히고, 모바일 사파리에서
 * 에디터 포커스를 빼앗아 커서 위치를 잃는다. 무엇보다 잘못된 주소를 **그 자리에서**
 * 알려 줄 수 없다.
 *
 * `<form>` 을 쓰지 않는 이유: 글쓰기 폼 안에 들어가는 조각이라 폼을 중첩할 수 없다.
 * Enter 는 keydown 으로 직접 받는다.
 */

type InlineUrlFieldProps = {
  label: string
  placeholder: string
  /** 유효하지 않은 주소일 때 돌려줄 문구. null 이면 성공으로 보고 닫는다. */
  onSubmit: (url: string) => string | null
  onCancel: () => void
}

export function InlineUrlField({ label, placeholder, onSubmit, onCancel }: InlineUrlFieldProps) {
  const inputId = useId()
  const errorId = useId()
  const [value, setValue] = useState('')
  const [error, setError] = useState<string | null>(null)

  function submit(): void {
    setError(onSubmit(value.trim()))
  }

  return (
    <div className="border-line-soft bg-sheet flex flex-wrap items-center gap-2 border-t px-3 py-2.5">
      <label htmlFor={inputId} className="text-ink shrink-0 text-[14px] font-medium">
        {label}
      </label>
      <input
        id={inputId}
        type="url"
        value={value}
        autoFocus
        inputMode="url"
        placeholder={placeholder}
        aria-invalid={error !== null}
        aria-describedby={error === null ? undefined : errorId}
        onChange={(event) => {
          setValue(event.target.value)
          setError(null)
        }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            // 엔터가 바깥 폼을 제출해 글이 등록되어 버리는 것을 막는다.
            event.preventDefault()
            submit()
          }

          if (event.key === 'Escape') {
            event.preventDefault()
            onCancel()
          }
        }}
        className="border-line-soft bg-surface text-ink placeholder:text-ink-muted focus-visible:outline-focus h-9 min-w-0 flex-1 rounded-[8px] border px-3 text-[15px] focus-visible:outline-2 focus-visible:outline-offset-1"
      />
      <button
        type="button"
        onClick={submit}
        className="bg-ink focus-visible:outline-focus h-9 shrink-0 rounded-[8px] px-3.5 text-[14px] font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        확인
      </button>
      <button
        type="button"
        onClick={onCancel}
        className="text-ink-muted hover:text-ink focus-visible:outline-focus h-9 shrink-0 rounded-[8px] px-2 text-[14px] font-medium focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        취소
      </button>
      {error === null ? null : (
        <p id={errorId} role="alert" className="text-badge-red basis-full text-[13px] font-medium">
          {error}
        </p>
      )}
    </div>
  )
}
