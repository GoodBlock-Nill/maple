'use client'

import { useActionState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { LogoutButton } from '@/components/auth/LogoutButton'
import { SubmitButton } from '@/components/auth/SubmitButton'
import { restoreAccountAction } from '@/lib/actions/account-actions'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'

type RestoreAccountFormProps = {
  /** 복구 뒤 돌아갈 곳. 서버가 이미 정규화한 값이다. */
  nextPath: string
  /** 파기가 끝난 계정은 복구 버튼을 두지 않는다 — 로그아웃만 남긴다. */
  canRestore: boolean
}

/**
 * 복구 화면의 두 버튼 — "계정 복구"(폼 POST) · "로그아웃"(별도 폼).
 *
 * 복구는 `deleted_at` 을 비우는 쓰기이므로 GET 링크가 아니라 폼이어야 한다
 * (`LogoutButton` 과 같은 CSRF 이유). 성공하면 액션이 `nextPath` 로 리다이렉트한다.
 */
export function RestoreAccountForm({ nextPath, canRestore }: RestoreAccountFormProps) {
  const [state, formAction] = useActionState(restoreAccountAction, EMPTY_FORM_STATE)

  return (
    <div className="flex flex-col gap-4">
      <FormFeedback state={state} />

      {canRestore ? (
        <form action={formAction}>
          <input type="hidden" name="next" value={nextPath} />
          <SubmitButton pendingLabel="복구 중…">계정 복구</SubmitButton>
        </form>
      ) : null}

      <LogoutButton variant="light" size="lg" className="text-ui w-full rounded-[10px]" />
    </div>
  )
}
