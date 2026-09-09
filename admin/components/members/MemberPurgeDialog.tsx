'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { purgeMemberNowAction } from '@/lib/actions/member-lifecycle-actions'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 개인정보 즉시 파기 — 슈퍼어드민 전용.
 *
 * 90일 배치를 기다리지 않고 지금 파기한다. 이용자가 직접 "지금 지워 달라"고
 * 요청했을 때 쓰는 창구다.
 *
 * 설명 문구가 **실제로 일어나는 일**을 그대로 적는다(개발자 가이드 §7.4). 되돌릴
 * 수 없다는 것과, 그럼에도 **글·댓글은 남는다**는 것 둘 다 필요하다 — 앞을 빼면
 * 운영자가 가볍게 누르고, 뒤를 빼면 게시판이 통째로 사라진다고 오해한다.
 */
export function MemberPurgeDialog({ memberId, nickname }: { memberId: string; nickname: string }) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (state: FormState, formData: FormData): Promise<FormState> => {
      const result = await purgeMemberNowAction(state, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        setOpen(false)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        개인정보 즉시 파기
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="개인정보 즉시 파기"
        description={`${nickname} 님의 개인정보를 90일을 기다리지 않고 지금 파기합니다. 되돌릴 수 없습니다. 작성한 글과 댓글은 남고 ‘탈퇴한 회원’으로 표시됩니다.`}
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="memberId" value={memberId} />

          <FormBanner message={state.formError} />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" variant="danger" disabled={isPending}>
              {isPending ? '파기 중…' : '파기'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
