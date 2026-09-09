'use client'

import { useCallback, useState } from 'react'

import { cn } from '@/lib/utils/cn'

import type { RefCallback } from 'react'

/**
 * 입력 글자수 표시(`현재 / 최대`).
 *
 * 운영자가 "몇 자까지 쓸 수 있는가"를 저장 버튼을 누른 뒤 오류 문구로 알게 되면
 * 이미 쓴 문장을 잘라 내야 한다. 그래서 텍스트 필드는 입력하는 동안 상한을 계속
 * 보여 준다(2026-09-09 운영 요청).
 *
 * 길이는 `String.length`(UTF-16 코드 단위)가 아니라 **코드 포인트**로 센다.
 * 이모지 하나가 2로 세어지면 화면의 숫자와 브라우저 `maxLength` 가 끊는 지점이
 * 어긋나 "아직 남았는데 더 안 써진다"가 된다.
 */
export function countCharacters(value: string): number {
  return [...value].length
}

/** `value`/`defaultValue` prop(문자열 · 숫자 · 배열)에서 셀 수 있는 문자열만 뽑는다. */
export function toCountableText(value: unknown): string {
  if (typeof value === 'string') {
    return value
  }

  return typeof value === 'number' ? String(value) : ''
}

type TextControl = HTMLInputElement | HTMLTextAreaElement

export type InputLength = {
  count: number
  /** 컨트롤에 그대로 거는 ref. 값 변화를 DOM 에서 직접 읽는다. */
  register: RefCallback<TextControl>
}

/**
 * 입력 길이를 세는 훅.
 *
 * 제어(`value`)·비제어(`defaultValue`) 두 방식이 관리자 폼에 섞여 있다. 상위
 * 상태만 보면 비제어 폼이 0 에 멈추고, DOM 만 보면 상위가 값을 되돌렸을 때
 * (저장 후 초기화) 숫자가 남는다. 그래서 둘 다 근거로 삼는다.
 *
 * @param value 제어 필드면 현재 값, 비제어 필드면 첫 값(`defaultValue`).
 * @param isControlled 상위가 값을 쥐고 있는가.
 */
export function useInputLength(value: string, isControlled: boolean): InputLength {
  const [domCount, setDomCount] = useState(() => countCharacters(value))

  /* 제어 필드는 상위 상태가 값의 출처다. 이펙트로 베끼면 상위가 값을 되돌린
     프레임에 옛 숫자가 한 번 보이고, 렌더 중 계산하면 그럴 일이 없다. */
  const count = isControlled ? countCharacters(value) : domCount

  const register = useCallback<RefCallback<TextControl>>(
    (element) => {
      if (element === null || isControlled) {
        /* 제어 필드는 위에서 계산한다. 여기서 input 이벤트를 또 들으면 리스너가
           React 의 위임 핸들러보다 **먼저** 돌아 setState 를 부르고, 아직 옛 값을
           들고 있는 상위가 그 렌더에서 DOM 값을 되돌려 방금 친 글자가 사라진다. */
        return
      }

      const sync = (): void => setDomCount(countCharacters(element.value))

      /* 이벤트 없이 채워지는 값(비제어 defaultValue · 브라우저 자동완성 · 붙여넣기
         복원)도 세어야 하므로 붙자마자 한 번 읽는다. */
      sync()
      element.addEventListener('input', sync)

      /* `form.reset()` 은 reset 이벤트를 먼저 흘리고 값을 그 뒤에 되돌린다.
         같은 틱에 읽으면 지운 직전 길이가 남는다(문의 답변 폼이 이 경로를 쓴다). */
      const form = element.form
      const handleReset = (): void => {
        window.setTimeout(sync, 0)
      }

      form?.addEventListener('reset', handleReset)

      return () => {
        element.removeEventListener('input', sync)
        form?.removeEventListener('reset', handleReset)
      }
    },
    [isControlled],
  )

  return { count, register }
}

/**
 * 글자수 알약. 상한에 닿으면 위험색으로 바뀐다 — 더 못 쓰는 이유가 화면에 있어야
 * 운영자가 입력이 "먹통"이라고 오해하지 않는다.
 *
 * 라이브 영역으로 두지 않는다. 한 글자마다 읽어 주면 스크린 리더가 입력을 덮는다.
 * 대신 `aria-describedby` 로 이어 붙여 포커스할 때 상한을 한 번 알려 준다.
 */
export function CharacterCount({ id, count, max }: { id: string; count: number; max: number }) {
  return (
    <p
      id={id}
      className={cn(
        'ml-auto shrink-0 text-[12px] tabular-nums',
        count >= max ? 'text-danger font-semibold' : 'text-muted',
      )}
    >
      <span aria-hidden="true">{`${count} / ${max}`}</span>
      <span className="sr-only">{`최대 ${max}자`}</span>
    </p>
  )
}
