'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { FormBanner } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { changeNicknameAction } from '@/lib/actions/members-actions'
import {
  NICKNAME_MAX_LENGTH,
  NICKNAME_MIN_LENGTH,
  SUSPENSION_REASON_MAX,
} from '@/lib/validation/members'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 닉네임 강제 변경.
 *
 * 이미 쓴 글·댓글의 `author_name` 은 작성 시점 스냅샷이라 바뀌지 않는다. 운영자가
 * 이 사실을 모르면 "바꿨는데 그대로"라고 오해하므로 다이얼로그에 명시한다.
 */
export function MemberNicknameDialog({
  memberId,
  nickname,
}: {
  memberId: string
  nickname: string
}) {
  const [isOpen, setOpen] = useState(false)
  const { showToast } = useToast()

  const run = useCallback(
    async (state: FormState, formData: FormData): Promise<FormState> => {
      const result = await changeNicknameAction(state, formData)

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
      <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
        닉네임 변경
      </Button>

      <Dialog
        open={isOpen}
        onClose={() => setOpen(false)}
        title="닉네임 강제 변경"
        description="이미 작성된 글·댓글의 표시 이름(작성 시점 스냅샷)은 바뀌지 않습니다."
      >
        <form action={formAction} className="flex flex-col gap-4" noValidate>
          <input type="hidden" name="memberId" value={memberId} />

          <FormBanner message={state.formError} />

          <Input
            label="새 닉네임"
            name="nickname"
            defaultValue={nickname}
            required
            minLength={NICKNAME_MIN_LENGTH}
            maxLength={NICKNAME_MAX_LENGTH}
            hint={`${NICKNAME_MIN_LENGTH}자 이상, 한글·영문·숫자·밑줄. 커뮤니티 목록·랭킹에서는 앞 두 글자만 남기고 가려 보입니다.`}
            error={state.fieldErrors?.nickname}
          />

          <Input
            label="사유"
            name="reason"
            required
            maxLength={SUSPENSION_REASON_MAX}
            placeholder="예: 부적절한 닉네임 신고 접수"
            hint="사용자에게는 보이지 않습니다. 감사 로그에만 남는 운영 기록입니다."
            error={state.fieldErrors?.reason}
          />

          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={isPending}>
              취소
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? '변경 중…' : '변경'}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  )
}
