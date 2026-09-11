'use client'

import { useRef } from 'react'

import type { SyntheticEvent } from 'react'

import { Button, Textarea } from '@/components/ui'
import {
  INQUIRY_REPLY_PLACEHOLDERS,
  SAMPLE_INQUIRY,
  applyReplyTemplate,
} from '@/lib/utils/inquiry-reply-template'
import { INQUIRY_REPLY_TEMPLATE_BODY_MAX } from '@/lib/validation/inquiry-reply-templates'

/**
 * 템플릿 본문 입력 — 자리표시자 버튼 + 예시 미리보기.
 *
 * 미리보기는 **치환된 뒤의 문장**을 보여 준다. 자리표시자를 그대로 그리면 운영자는
 * "{{닉네임}} 이 정말 이름으로 바뀌나"를 저장하고 문의를 열어 봐야 확인할 수 있다.
 * 예시 문의(`SAMPLE_INQUIRY`)로 채우는 이유는 템플릿이 특정 문의에 매이지 않기 때문이다.
 *
 * 자리표시자 버튼은 **커서 자리에** 끼워 넣는다. 끝에만 붙이면 문장 중간에 넣으려는
 * 운영자가 매번 잘라내기·붙여넣기를 해야 한다. textarea 요소는 `ref` 가 아니라
 * 이벤트의 `currentTarget` 에서 붙잡는다 — 공용 `Textarea` 는 글자수 측정에 자기 ref 를
 * 쓰므로 바깥에서 ref 를 걸 자리가 없다.
 */
export function InquiryReplyTemplateBodyField({
  value,
  onChange,
  error,
}: {
  value: string
  onChange: (next: string) => void
  error?: string
}) {
  const inputRef = useRef<HTMLTextAreaElement | null>(null)

  function capture(event: SyntheticEvent<HTMLTextAreaElement>): void {
    inputRef.current = event.currentTarget
  }

  function insert(token: string): void {
    const element = inputRef.current

    if (element === null) {
      onChange(`${value}${token}`)

      return
    }

    const start = element.selectionStart
    const end = element.selectionEnd
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`

    onChange(next)

    /* 값이 바뀐 뒤에 커서를 되돌린다. 그러지 않으면 포커스가 버튼에 남아 다음
       글자가 엉뚱한 곳에 찍힌다. */
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(start + token.length, start + token.length)
    })
  }

  return (
    <>
      <Textarea
        label="템플릿 내용"
        name="body"
        rows={9}
        required
        maxLength={INQUIRY_REPLY_TEMPLATE_BODY_MAX}
        value={value}
        onChange={(event) => {
          capture(event)
          onChange(event.target.value)
        }}
        onFocus={capture}
        onSelect={capture}
        hint="답변 칸에 그대로 채워집니다. 줄바꿈은 유지되고 마크다운은 해석되지 않습니다."
        error={error}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-muted text-[12px] font-semibold">
          자리표시자 (불러올 때 문의 정보로 바뀝니다)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {INQUIRY_REPLY_PLACEHOLDERS.map((placeholder) => (
            <Button
              key={placeholder.token}
              variant="secondary"
              size="sm"
              title={placeholder.description}
              onClick={() => insert(placeholder.token)}
              className="h-7 px-2 text-[12px]"
            >
              {placeholder.token}
            </Button>
          ))}
        </div>
        <ul className="text-muted flex flex-col gap-0.5 text-[12px]">
          {INQUIRY_REPLY_PLACEHOLDERS.map((placeholder) => (
            <li key={placeholder.token}>{`${placeholder.token} · ${placeholder.description}`}</li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-muted text-[12px] font-semibold">
          {`미리보기 (예시 문의 · ${SAMPLE_INQUIRY.nickname} / ${SAMPLE_INQUIRY.category})`}
        </span>
        <p className="border-line bg-page text-ink rounded-panel border px-3 py-2.5 text-[13px] leading-relaxed whitespace-pre-line">
          {value === ''
            ? '내용을 입력하면 자리표시자가 채워진 모습이 보입니다.'
            : applyReplyTemplate(value, SAMPLE_INQUIRY)}
        </p>
      </div>
    </>
  )
}
