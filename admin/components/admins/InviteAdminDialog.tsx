'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { inviteAdminAction } from '@/lib/actions/admin-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

import type { FormState } from '@/lib/actions/form-state'

/**
 * "관리자 초대" 다이얼로그.
 *
 * 결과 안내는 토스트로 띄우고 다이얼로그는 닫는다. 다이얼로그 안에 성공 문구를
 * 남겨 두면 사용자가 같은 주소로 한 번 더 보내는 실수를 하기 쉽다.
 */
export function InviteAdminDialog() {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  /* 성공 처리를 이펙트가 아니라 액션 안에서 한다. 이펙트로 두면 렌더가 한 번 더
     돌면서 "닫히는 도중의 다이얼로그"가 잠깐 그려지고, 같은 결과를 두 번 처리할
     여지도 생긴다(React 19 의 set-state-in-effect 경고가 가리키는 지점이다). */
  const runInvite = useCallback(
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

  const [state, formAction, isPending] = useActionState(runInvite, EMPTY_FORM_STATE)

  return (
    <>
      <Button onClick={() => setOpen(true)}>관리자 초대</Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="관리자 초대"
        description="초대 메일의 링크로 비밀번호를 설정하면 관리자 권한이 부여됩니다."
      >
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <FormBanner message={state.formError} />

          <Input
            label="이메일"
            name="email"
            type="email"
            autoComplete="off"
            placeholder="name@example.com"
            required
            error={state.fieldErrors?.email}
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
