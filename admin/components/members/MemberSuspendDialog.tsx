'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner, FormError } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { suspendMemberAction } from '@/lib/actions/members-actions'
import { SUSPENSION_PERIOD_OPTIONS, SUSPENSION_REASON_MAX } from '@/lib/validation/members'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 회원 정지 다이얼로그.
 *
 * 기간은 프리셋 라디오로만 받는다. 임의 날짜 입력을 열면 "언제까지"가 사람마다
 * 달라져 같은 위반에 다른 제재가 나가고, 기록을 모아 봐도 기준을 재구성할 수 없다.
 * 사유는 필수다 — 정지 해제 요청이 들어왔을 때 판단 근거가 되는 유일한 기록이다.
 */
export function MemberSuspendDialog({
  memberId,
  nickname,
  isSuspended,
}: {
  memberId: string
  nickname: string
  isSuspended: boolean
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (state: FormState, formData: FormData): Promise<FormState> => {
      const result = await suspendMemberAction(state, formData)

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
        {isSuspended ? '정지 기간 변경' : '정지'}
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title={`${nickname} 님 정지`}
        description="정지된 회원은 글·댓글·신고·좋아요를 남길 수 없습니다. 열람은 그대로 가능합니다."
      >
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="memberId" value={memberId} />

          <FormBanner message={state.formError} />

          <fieldset className="flex flex-col gap-2">
            <legend className="text-ink mb-1 text-[13px] font-semibold">기간</legend>
            <div className="flex flex-wrap gap-3">
              {SUSPENSION_PERIOD_OPTIONS.map((option, index) => (
                <label key={option.value} className="flex items-center gap-1.5 text-[13px]">
                  <input
                    type="radio"
                    name="period"
                    value={option.value}
                    defaultChecked={index === 1}
                    className="accent-accent size-4"
                  />
                  {option.label}
                </label>
              ))}
            </div>
            <FormError message={state.fieldErrors?.period} />
          </fieldset>

          <Input
            label="사유"
            name="reason"
            required
            maxLength={SUSPENSION_REASON_MAX}
            placeholder="예: 반복적인 욕설로 신고 3건 누적"
            hint="사용자 화면의 정지 안내 배너에 “사유: …” 로 그대로 붙습니다. 한 줄로 읽히도록 40자 이내를 권합니다."
            error={state.fieldErrors?.reason}
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" variant="danger" disabled={isPending}>
              {isPending ? '정지 중…' : '정지'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
