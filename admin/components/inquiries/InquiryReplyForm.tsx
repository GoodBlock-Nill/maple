'use client'

import { useActionState, useCallback, useRef, useState } from 'react'

import { Button, Card, CardBody, CardHeader, FormBanner, Textarea, useToast } from '@/components/ui'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { replyToInquiryAction } from '@/lib/actions/inquiries-actions'
import {
  INQUIRY_REPLY_MAX_LENGTH,
  INQUIRY_REPLY_NEXT_STATUSES,
  INQUIRY_STATUS_LABELS,
} from '@/lib/validation/inquiries'

import type { FormState } from '@/lib/actions/form-state'

const OPERATOR_NAME = '운영자'

/**
 * 답변 작성.
 *
 * 사용자 화면은 답변을 **평문**으로 그린다(줄바꿈만 살린다). 마크다운을 지원하는
 * 것처럼 보이면 `**강조**` 가 그대로 노출되므로 편집기를 붙이지 않는다.
 *
 * 성공하면 폼을 직접 비운다 — `revalidatePath` 로 스레드는 갱신되지만 입력값은
 * 클라이언트 상태라 그대로 남아, 같은 답변을 두 번 등록하기 쉽다.
 */
export function InquiryReplyForm({
  inquiryId,
  adminNickname,
}: {
  inquiryId: string
  adminNickname: string
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [length, setLength] = useState(0)
  const { showToast } = useToast()

  const run = useCallback(
    async (prevState: FormState, formData: FormData): Promise<FormState> => {
      const result = await replyToInquiryAction(prevState, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        formRef.current?.reset()
        setLength(0)
      }

      return result
    },
    [showToast],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <Card>
      <CardHeader
        title="답변 작성"
        description="등록하면 사용자의 '내 문의 내역' 화면에 바로 표시됩니다."
      />
      <CardBody>
        <form ref={formRef} action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="inquiryId" value={inquiryId} />

          <FormBanner message={state.formError} />

          <Textarea
            label="답변 내용"
            name="content"
            rows={7}
            required
            maxLength={INQUIRY_REPLY_MAX_LENGTH}
            placeholder="사용자가 그대로 읽는 문장입니다. 줄바꿈은 그대로 보입니다."
            hint={`${length}/${INQUIRY_REPLY_MAX_LENGTH}자`}
            error={state.fieldErrors?.content}
            onChange={(event) => setLength(event.target.value.length)}
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="text-ink flex items-center gap-2 text-[13px]">
              <input
                type="checkbox"
                name="useOperatorName"
                defaultChecked
                className="accent-accent size-4"
              />
              {`'${OPERATOR_NAME}' 명의로 표시`}
              <span className="text-muted">{`(해제하면 ${adminNickname})`}</span>
            </label>

            <div className="flex items-center gap-2">
              <label className="text-muted text-[13px]" htmlFor="inquiry-next-status">
                등록 후 상태
              </label>
              <select
                id="inquiry-next-status"
                name="nextStatus"
                defaultValue={INQUIRY_REPLY_NEXT_STATUSES[0]}
                className="rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-9 border px-3 text-[13px] focus:outline-2"
              >
                {INQUIRY_REPLY_NEXT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {INQUIRY_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
              <Button type="submit" disabled={isPending}>
                {isPending ? '등록 중…' : '답변 등록'}
              </Button>
            </div>
          </div>
        </form>
      </CardBody>
    </Card>
  )
}
