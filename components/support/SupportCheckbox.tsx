'use client'

import { useState } from 'react'

import {
  SUPPORT_CHECKBOX_BOX_CLASS,
  SUPPORT_CHECKBOX_INPUT_CLASS,
} from '@/components/support/support-styles'
import { cn } from '@/lib/utils/cn'

/** 단위 테스트가 켜진 그림을 찾을 때 쓰는 표식. 화면에는 드러나지 않는다. */
export const CHECK_MARK_TEST_ID = 'support-checkbox-mark'

type CheckMarkProps = {
  className?: string
}

/**
 * 켜진 상자 위에 얹는 흰 체크.
 *
 * 상자(테두리·채움·모서리)는 입력이 직접 그리므로 여기서는 표시선만 그린다 —
 * 시안 실측값(30×30 · border 1.5 `#d5d9df` · radius 5)이 한 자리에만 남는다.
 * 획은 `vector-effect` 없이 두께를 뷰박스 기준으로 잡아, 20 으로 줄여 써도
 * 30 과 같은 비율로 얇아진다.
 */
function CheckMarkGlyph({ className }: CheckMarkProps) {
  return (
    <svg
      viewBox="0 0 30 30"
      fill="none"
      aria-hidden
      focusable="false"
      data-testid={CHECK_MARK_TEST_ID}
      className={className}
    >
      <path
        d="M8.5 15.4L12.9 19.8L21.5 11"
        stroke="#fff"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

type SupportCheckboxProps = {
  /** FormData 키. 서버 액션·스키마가 이 이름으로 읽는다. */
  name: string
  /** 라벨(`htmlFor`)이 가리킬 id. 라벨 없이 쓰는 자리에서는 생략한다. */
  id?: string
  /** 여러 개가 같은 이름으로 실릴 때 구분할 값(첨부 삭제 목록의 오브젝트 키). */
  value?: string
  defaultChecked?: boolean
  /** 필수 동의처럼 비워 둘 수 없는 자리. */
  required?: boolean
  /** 상자 크기 유틸리티. 기본은 시안의 동의 체크박스 30. */
  boxClassName?: string
  onChange?: (checked: boolean) => void
  'aria-label'?: string
  'aria-describedby'?: string
}

/**
 * 고객지원 폼의 체크박스.
 *
 * `appearance: none` 은 네이티브 체크 표시까지 함께 지운다. 상자만 칠하고 두면
 * 켠 상태가 **표시 없는 검은 사각형**으로 보여, 사용자는 동의가 됐는지 화면에서
 * 알 수 없다(2026-09-11 오너 제보). 그래서 켜졌을 때 흰 체크를 직접 얹는다.
 *
 * 그림은 `:checked` 의사 클래스가 아니라 리액트 상태로 그린다 — 회원가입
 * 체크박스(`OnboardingCheckbox`)와 같은 방식이라 두 화면이 같은 규칙으로 움직이고,
 * 단위 테스트가 CSS 없이도 켜짐/꺼짐을 그대로 확인할 수 있다.
 *
 * 네이티브 `<input>` 을 숨기지 않고 **그 자체를 보이는 상자로** 쓴다. `sr-only`
 * 나 `opacity-0` 로 덮으면 클릭 지점과 보이는 그림이 갈려서, 자동화 도구와
 * 실기기에서 "눌렀는데 안 켜진다"가 생긴다. 체크 그림은 입력 위에 겹치되
 * `pointer-events-none` 이라 클릭을 가로채지 않는다.
 */
export function SupportCheckbox({
  name,
  id,
  value,
  defaultChecked = false,
  required,
  boxClassName,
  onChange,
  'aria-label': ariaLabel,
  'aria-describedby': ariaDescribedBy,
}: SupportCheckboxProps) {
  const [isChecked, setIsChecked] = useState(defaultChecked)

  return (
    <span className={cn(SUPPORT_CHECKBOX_BOX_CLASS, boxClassName)}>
      <input
        id={id}
        name={name}
        value={value}
        type="checkbox"
        required={required}
        defaultChecked={defaultChecked}
        onChange={(event) => {
          setIsChecked(event.target.checked)
          onChange?.(event.target.checked)
        }}
        aria-label={ariaLabel}
        aria-describedby={ariaDescribedBy}
        className={SUPPORT_CHECKBOX_INPUT_CLASS}
      />
      {isChecked ? (
        <CheckMarkGlyph className="pointer-events-none absolute inset-0 size-full" />
      ) : null}
    </span>
  )
}
