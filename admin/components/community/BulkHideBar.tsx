'use client'

import { useActionState, useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { josa } from '@/lib/utils/josa'

import type { FormState } from '@/lib/actions/form-state'

export const BULK_FORM_ID = 'bulk-hide-form'

/**
 * 일괄 숨김 막대.
 *
 * 체크박스는 표 안에(서버 렌더) 있고 폼은 표 밖에 있다. 둘을 `form` 속성으로 잇는다 —
 * 표를 `<form>` 으로 감싸면 행마다 있는 조치 폼과 **중첩 폼**이 되어 HTML 이 깨진다.
 *
 * 선택 개수는 문서 레벨 change 이벤트로 센다. 체크박스가 폼의 자식이 아니므로
 * 폼에 onChange 를 걸어도 이벤트가 올라오지 않는다.
 */
export function BulkHideBar({
  action,
  label,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>
  label: string
}) {
  const { showToast } = useToast()
  const [selected, setSelected] = useState(0)

  const run = useCallback(
    async (state: FormState, formData: FormData): Promise<FormState> => {
      const result = await action(state, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setSelected(0)
      }

      if (result.formError !== undefined) {
        showToast(result.formError, 'error')
      }

      return result
    },
    [action, showToast],
  )

  const [, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  useEffect(() => {
    function recount() {
      setSelected(document.querySelectorAll(`input[form="${BULK_FORM_ID}"]:checked`).length)
    }

    document.addEventListener('change', recount)
    recount()

    return () => document.removeEventListener('change', recount)
  }, [])

  const toggleAll = useCallback(() => {
    const boxes = document.querySelectorAll<HTMLInputElement>(
      `input[form="${BULK_FORM_ID}"]:not(:disabled)`,
    )
    const next = selected < boxes.length

    for (const box of boxes) {
      box.checked = next
    }

    setSelected(next ? boxes.length : 0)
  }, [selected])

  return (
    <div className="border-line flex items-center justify-between gap-3 border-b px-5 py-3">
      <p className="text-muted text-[13px]">
        {selected === 0
          ? `${label}${josa(label, '을')} 선택해 일괄 숨김할 수 있습니다.`
          : `${selected}건 선택됨`}
      </p>

      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={toggleAll}>
          전체 선택/해제
        </Button>
        {/* 폼은 비어 있다 — 값은 표 안의 체크박스가 form 속성으로 실어 보낸다. */}
        <form id={BULK_FORM_ID} action={formAction}>
          <Button
            type="submit"
            variant="secondary"
            size="sm"
            disabled={isPending || selected === 0}
          >
            {isPending ? '숨기는 중…' : '선택 숨김'}
          </Button>
        </form>
      </div>
    </div>
  )
}

/** 표의 선택 칸. 이미 숨김·삭제된 행은 고를 수 없다. */
export function BulkSelectCheckbox({
  id,
  label,
  disabled,
}: {
  id: string
  label: string
  disabled: boolean
}) {
  return (
    <input
      type="checkbox"
      name="ids"
      value={id}
      form={BULK_FORM_ID}
      disabled={disabled}
      aria-label={`${label} 선택`}
      className="accent-accent size-4 align-middle disabled:opacity-40"
    />
  )
}
