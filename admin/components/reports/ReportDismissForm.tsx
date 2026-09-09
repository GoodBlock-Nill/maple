'use client'

import { useActionState, useCallback } from 'react'

import { Button } from '@/components/ui/Button'
import { FormBanner } from '@/components/ui/FormField'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { dismissReportAction } from '@/lib/actions/reports-actions'
import { MODERATION_NOTE_MAX } from '@/lib/validation/moderation'

import type { FormState } from '@/lib/actions/form-state'

/**
 * 신고 "기각" 폼.
 *
 * 사유를 필수로 받는다(스키마에서도 강제). 근거 없이 닫힌 신고는 같은 대상이 다시
 * 올라왔을 때 "지난번에 왜 넘겼는지"를 아무도 재구성할 수 없다.
 */
export function ReportDismissForm({
  reportId,
  openCountForTarget,
  onDone,
}: {
  reportId: string
  openCountForTarget: number
  onDone: () => void
}) {
  const { showToast } = useToast()

  const run = useCallback(
    async (state: FormState, formData: FormData): Promise<FormState> => {
      const result = await dismissReportAction(state, formData)

      if (result.message !== undefined) {
        showToast(result.message, 'success')
        onDone()
      }

      return result
    },
    [showToast, onDone],
  )

  const [state, formAction, isPending] = useActionState(run, EMPTY_FORM_STATE)

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="reportId" value={reportId} />

      <FormBanner message={state.formError} />

      <Textarea
        label="기각 사유"
        name="note"
        rows={3}
        required
        maxLength={MODERATION_NOTE_MAX}
        placeholder="예: 신고 사유에 해당하지 않는 정상 게시물"
        hint="신고자·작성자에게는 보이지 않습니다. 감사 로그에만 남습니다."
        error={state.fieldErrors?.note}
      />

      {openCountForTarget > 1 && (
        <label className="text-muted flex items-center gap-2 text-[13px]">
          <input
            type="checkbox"
            name="applyToTarget"
            value="1"
            defaultChecked
            className="accent-accent size-4"
          />
          같은 대상의 미처리 신고 {openCountForTarget}건을 함께 기각
        </label>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={isPending}>
          닫기
        </Button>
        <Button type="submit" variant="danger" disabled={isPending}>
          {isPending ? '처리 중…' : '기각'}
        </Button>
      </div>
    </form>
  )
}
