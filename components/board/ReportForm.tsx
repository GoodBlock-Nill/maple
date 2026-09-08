'use client'

import { useActionState, useState } from 'react'

import { FormFeedback } from '@/components/auth/FormFeedback'
import { BOARD_ACTION_CLASS, BOARD_DANGER_CLASS } from '@/components/board/board-styles'
import { SuspensionNotice } from '@/components/board/SuspensionNotice'
import { Textarea } from '@/components/ui/Textarea'
import { EMPTY_FORM_STATE } from '@/lib/actions/form-state'
import { submitReport } from '@/lib/actions/report-actions'
import { REPORT_DETAIL_MAX, REPORT_REASONS, REPORT_TARGET_LABEL } from '@/lib/constants/report'

import type { ReportTargetType } from '@/lib/constants/report'

type ReportFormProps = {
  targetType: ReportTargetType
  targetId: string
  /** 비로그인 상태로 액션이 직접 호출됐을 때 로그인 후 돌아올 경로. */
  nextPath: string
  titleId: string
  /** 뷰어 본인의 정지 안내. 넘어오면 배너를 띄우고 접수 버튼을 잠근다. */
  suspensionNotice?: string | null
  onClose: () => void
}

/**
 * 신고 다이얼로그의 본문.
 *
 * 다이얼로그가 닫히면 통째로 언마운트되므로 `useActionState` 도 함께 초기화된다.
 * 다시 열었을 때 지난 제출의 문구가 남지 않는 것은 그 덕분이다.
 */
export function ReportForm({
  targetType,
  targetId,
  nextPath,
  titleId,
  suspensionNotice = null,
  onClose,
}: ReportFormProps) {
  const [state, formAction, isPending] = useActionState(submitReport, EMPTY_FORM_STATE)
  const [detailLength, setDetailLength] = useState(0)

  const targetLabel = REPORT_TARGET_LABEL[targetType]
  const isDone = state.message !== undefined
  const isSuspended = suspensionNotice !== null

  return (
    <>
      <h2 id={titleId} className="text-ink text-body-lg font-semibold">
        {targetLabel} 신고
      </h2>
      <p className="text-ink-muted mt-2 text-[14px] leading-[1.6]">
        신고 사유를 선택해 주세요. 접수된 내용은 운영정책에 따라 검토됩니다.
      </p>

      <form action={formAction} className="mt-5 flex flex-col gap-5">
        {isSuspended ? <SuspensionNotice message={suspensionNotice} compact /> : null}

        <FormFeedback state={state} />

        <input type="hidden" name="targetType" value={targetType} />
        <input type="hidden" name="targetId" value={targetId} />
        <input type="hidden" name="next" value={nextPath} />

        {isDone ? null : (
          <>
            <fieldset>
              <legend className="text-ink text-[13px] font-bold">신고 사유</legend>
              <div className="flex flex-wrap gap-2 pt-3">
                {REPORT_REASONS.map((reason) => (
                  <label key={reason.value} className="cursor-pointer">
                    <input
                      type="radio"
                      name="reason"
                      value={reason.value}
                      required
                      className="peer sr-only"
                    />
                    <span className="board-control text-ink-muted peer-checked:bg-ink peer-checked:border-ink peer-focus-visible:outline-focus inline-flex h-9 items-center px-[13px] text-[15px] font-medium transition-colors peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
                      {reason.label}
                    </span>
                  </label>
                ))}
              </div>
              {state.fieldErrors?.reason === undefined ? null : (
                <p role="alert" className="text-badge-red mt-2 text-[13px] font-medium">
                  {state.fieldErrors.reason}
                </p>
              )}
            </fieldset>

            <Textarea
              label="상세 내용 (선택)"
              name="detail"
              rows={4}
              maxLength={REPORT_DETAIL_MAX}
              placeholder="구체적인 상황을 적어 주시면 검토에 도움이 됩니다."
              hint={`${detailLength}/${REPORT_DETAIL_MAX}자`}
              error={state.fieldErrors?.detail}
              onChange={(event) => setDetailLength(event.currentTarget.value.length)}
              className="border-line-soft rounded-[10px] text-input-sm placeholder:text-[#9a9a9a]"
            />
          </>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={BOARD_ACTION_CLASS + ' h-11 px-5'}>
            {isDone ? '닫기' : '취소'}
          </button>
          {isDone ? null : (
            <button
              type="submit"
              disabled={isPending || isSuspended}
              className={BOARD_DANGER_CLASS}
            >
              {isPending ? '접수 중' : '신고하기'}
            </button>
          )}
        </div>
      </form>
    </>
  )
}
