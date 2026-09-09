'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { changeAdminRoleAction } from '@/lib/actions/admin-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { SelectOption } from '@/components/ui/Select'
import type { FormState } from '@/lib/actions/form-state'

/**
 * 목록 행의 역할 변경 — 선택 + 저장.
 *
 * 고르자마자 저장하지 않는다. 셀렉트는 키보드 화살표로 값이 스쳐 지나가므로,
 * 그 순간 저장하면 의도하지 않은 역할이 잠깐 적용된다. 값이 바뀌었을 때만 저장
 * 버튼이 살아난다.
 */
export function AdminRoleSelect({
  adminId,
  currentRoleId,
  roleOptions,
  isSelf,
}: {
  adminId: string
  currentRoleId: string | null
  roleOptions: readonly SelectOption[]
  isSelf: boolean
}) {
  const [value, setValue] = useState(currentRoleId ?? '')
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await changeAdminRoleAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
      }

      if (result.formError !== undefined) {
        showToast(result.formError, 'error')
        setValue(currentRoleId ?? '')
      }

      return result
    },
    [currentRoleId, showToast],
  )

  const [, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  if (isSelf) {
    return <span className="text-muted text-[12px]">자기 역할은 바꿀 수 없습니다.</span>
  }

  return (
    <form action={formAction} className="flex items-center gap-1.5">
      <input type="hidden" name="adminId" value={adminId} />
      <Select
        name="roleId"
        aria-label="역할"
        options={roleOptions}
        placeholder={currentRoleId === null ? '역할 없음' : undefined}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        wrapperClassName="w-[160px]"
      />
      <Button
        type="submit"
        size="sm"
        variant="secondary"
        disabled={isPending || value === '' || value === (currentRoleId ?? '')}
      >
        {isPending ? '저장 중…' : '저장'}
      </Button>
    </form>
  )
}
