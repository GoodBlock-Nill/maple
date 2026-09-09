'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Select } from '@/components/ui/Select'
import { useToast } from '@/components/ui/Toast'
import { inviteAdminAction } from '@/lib/actions/admin-invite-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { EMAIL_MAX_LENGTH } from '@/lib/constants/field-limits'

import type { SelectOption } from '@/components/ui/Select'
import type { FormState } from '@/lib/actions/form-state'

/**
 * 관리자 초대 다이얼로그.
 *
 * 이메일과 역할을 정하면 초대 메일이 나가고, 받은 사람이 링크에서 **스스로**
 * 비밀번호를 정한다. 여기서 비밀번호를 대신 정하지 않는 이유: 운영자가 만든
 * 비밀번호는 어딘가(메신저·메모)에 평문으로 남는다.
 */
export function InviteAdminDialog({ roleOptions }: { roleOptions: readonly SelectOption[] }) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await inviteAdminAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)
  const [email, setEmail] = useState('')

  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={roleOptions.length === 0}>
        관리자 초대
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="관리자 초대"
        description="입력한 주소로 초대 메일이 갑니다. 받은 사람이 링크에서 비밀번호를 직접 정합니다."
      >
        {/* noValidate: 브라우저 기본 말풍선 대신 다른 폼과 같은 한국어 필드 오류를 보여 준다.
            이메일은 제어 입력이다 — 액션이 끝나면 React 가 폼을 초기화하므로 오류가 났을 때
            운영자가 쓴 주소가 지워지지 않게 값을 붙잡아 둔다. */}
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <FormBanner message={state.formError} />

          <Input
            label="이메일"
            name="email"
            type="email"
            autoComplete="off"
            required
            autoFocus
            maxLength={EMAIL_MAX_LENGTH}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={state.fieldErrors?.email}
          />

          <Select
            label="역할"
            name="roleId"
            required
            options={roleOptions}
            defaultValue={roleOptions[0]?.value}
            error={state.fieldErrors?.roleId}
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '보내는 중…' : '초대 메일 보내기'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
