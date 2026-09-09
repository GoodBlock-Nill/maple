'use client'

import { useActionState, useCallback } from 'react'

import { Button, FormError, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { resendInquiryEmailAction } from '@/lib/actions/inquiry-email-actions'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 발송에 실패한 답신을 다시 보낸다.
 *
 * 스레드 자체는 서버 컴포넌트로 두고 이 버튼만 클라이언트다 — 답신 목록은 상호작용이
 * 없고, 클라이언트로 내리면 본문 전체가 번들에 실린다.
 *
 * 확인 다이얼로그는 두지 않는다(개발자 가이드 §7.4). 되돌리기 어려운 조작이 아니고,
 * 애초에 "실패해서 아직 못 보낸" 메일을 보내는 것이라 한 번 더 묻는 것이 방해가 된다.
 */
export function InquiryResendButton({ replyId }: { replyId: string }) {
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await resendInquiryEmailAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="replyId" value={replyId} />
      <Button type="submit" variant="secondary" size="sm" disabled={isPending}>
        {isPending ? '보내는 중…' : '다시 보내기'}
      </Button>
      <FormError message={state.formError} />
    </form>
  )
}
