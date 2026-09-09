'use client'

import { useActionState, useCallback, useState } from 'react'

import { PermissionMatrixField } from '@/components/admins/PermissionMatrixField'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { createAdminRoleAction, updateAdminRoleAction } from '@/lib/actions/admin-role-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { ROLE_DESCRIPTION_MAX_LENGTH, ROLE_NAME_MAX_LENGTH } from '@/lib/validation/admins'

import type { AdminRoleItem } from '@/lib/data/admins'
import type { FormState } from '@/lib/actions/form-state'

/**
 * 역할 만들기 · 수정 다이얼로그.
 *
 * `key` 는 만들 때만 입력받고 수정에서는 읽기 전용으로 보여 준다. 바꿀 수 있게
 * 두면 이미 남은 감사 로그가 다른 역할을 가리키게 되고, DB 트리거도 되돌린다.
 */
export function RoleFormDialog({ role }: { role: AdminRoleItem | null }) {
  const isEdit = role !== null
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = isEdit
        ? await updateAdminRoleAction(prevState, formData)
        : await createAdminRoleAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [isEdit, showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <>
      <Button
        variant={isEdit ? 'secondary' : 'primary'}
        size="sm"
        onClick={() => setOpen(true)}
        disabled={role?.isSystem === true}
      >
        {isEdit ? '수정' : '역할 추가'}
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title={isEdit ? '역할 수정' : '역할 추가'}
        description="모듈마다 없음 · 읽기 · 쓰기 중 하나를 고릅니다. 쓰기는 읽기를 포함합니다."
      >
        {/* key 는 `${role?.id}` 로 묶어, 다른 역할을 열었을 때 비제어 입력이 이전 값을 남기지 않게 한다. */}
        <form key={role?.id ?? 'new'} action={formAction} className="flex flex-col gap-4">
          {isEdit && <input type="hidden" name="roleId" value={role.id} />}

          <FormBanner message={state.formError} />

          {isEdit ? (
            <p className="text-muted text-[12px]">
              키 <code className="text-ink font-semibold">{role.key}</code> · 만든 뒤에는 바꿀 수
              없습니다.
            </p>
          ) : (
            <Input
              label="키"
              name="key"
              required
              autoFocus
              placeholder="content_editor"
              hint="영문 소문자로 시작하는 slug. 만든 뒤에는 바꿀 수 없습니다."
              error={state.fieldErrors?.key}
            />
          )}

          <Input
            label="이름"
            name="name"
            required
            maxLength={ROLE_NAME_MAX_LENGTH}
            defaultValue={role?.name ?? ''}
            error={state.fieldErrors?.name}
          />

          <Input
            label="설명"
            name="description"
            maxLength={ROLE_DESCRIPTION_MAX_LENGTH}
            defaultValue={role?.description ?? ''}
            error={state.fieldErrors?.description}
          />

          <PermissionMatrixField defaults={role?.permissions ?? {}} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '저장 중…' : '저장'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
