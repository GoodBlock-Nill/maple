'use client'

import { useActionState, useCallback, useState } from 'react'

import { Button } from '@/components/ui/Button'
import { FormBanner, FormError } from '@/components/ui/FormField'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { useToast } from '@/components/ui/Toast'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { resolveReportAction } from '@/lib/actions/reports-actions'
import { SUSPENSION_PERIOD_OPTIONS } from '@/lib/validation/members'
import { MODERATION_NOTE_MAX, REPORT_ACTION_LABEL, REPORT_ACTIONS } from '@/lib/validation/moderation'

import type { FormState } from '@/lib/actions/form-state'
import type { ReportAction } from '@/lib/validation/moderation'

const ACTION_HINT: Record<ReportAction, string> = {
  hide: '대상을 숨깁니다. 작성자에게도 보이지 않습니다.',
  delete: '대상에 삭제 표시를 남깁니다. 복구할 수 있습니다.',
  suspend: '작성자의 글·댓글·신고·좋아요 작성을 기간 동안 막습니다.',
  none: '기록만 남기고 대상은 그대로 둡니다.',
}

/**
 * 신고 "처리" 폼.
 *
 * 조치와 종결을 한 번의 액션으로 묶는다. 숨김과 상태 변경을 따로 누르게 두면
 * 둘 중 하나만 된 상태가 남고, 그 상태를 화면에서 구분할 방법이 없다.
 */
export function ReportResolveForm({
  reportId,
  openCountForTarget,
  onDone,
}: {
  reportId: string
  openCountForTarget: number
  onDone: () => void
}) {
  const { showToast } = useToast()
  const [action, setAction] = useState<ReportAction>('hide')

  const run = useCallback(
    async (state: FormState, formData: FormData): Promise<FormState> => {
      const result = await resolveReportAction(state, formData)

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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-ink mb-1 text-[13px] font-semibold">조치</legend>
        {REPORT_ACTIONS.map((value) => (
          <label
            key={value}
            className="border-line hover:bg-page flex cursor-pointer items-start gap-2 rounded-panel border px-3 py-2"
          >
            <input
              type="radio"
              name="action"
              value={value}
              checked={action === value}
              onChange={() => setAction(value)}
              className="accent-accent mt-0.5 size-4"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-ink text-[13px] font-semibold">
                {REPORT_ACTION_LABEL[value]}
              </span>
              <span className="text-muted text-[12px]">{ACTION_HINT[value]}</span>
            </span>
          </label>
        ))}
        <FormError message={state.fieldErrors?.action} />
      </fieldset>

      {action === 'suspend' && (
        <fieldset className="border-line flex flex-col gap-3 rounded-panel border px-3 py-3">
          <legend className="text-ink px-1 text-[13px] font-semibold">정지 설정</legend>
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
          <Input
            label="정지 사유"
            name="suspensionReason"
            placeholder="예: 반복적인 욕설"
            error={state.fieldErrors?.suspensionReason}
          />
        </fieldset>
      )}

      <Textarea
        label="처리 메모"
        name="note"
        rows={3}
        maxLength={MODERATION_NOTE_MAX}
        placeholder="판단 근거를 남겨 주세요."
        hint="메모는 감사 로그에 저장됩니다(신고 테이블에는 메모 컬럼이 없습니다)."
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
          같은 대상의 미처리 신고 {openCountForTarget}건을 함께 처리
        </label>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone} disabled={isPending}>
          닫기
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? '처리 중…' : '처리 완료'}
        </Button>
      </div>
    </form>
  )
}
