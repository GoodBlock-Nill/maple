import { Button } from '@/components/ui'
import { INQUIRY_REPLY_NEXT_STATUSES, INQUIRY_STATUS_LABELS } from '@/lib/validation/inquiries'

const OPERATOR_NAME = '운영자'

const NEXT_STATUS_HINT_ID = 'inquiry-next-status-hint'

/**
 * 답변 폼의 아래 줄 — 명의 · 등록 후 상태 · 제출.
 *
 * `InquiryReplyForm` 에서 떼어 낸 것은 안내 문구가 붙으면서 그 파일이 컴포넌트
 * 상한(200줄)에 닿았기 때문이다. 상태를 갖지 않으므로 폼의 값은 그대로
 * `name` 으로만 오간다(GET/POST 규약은 폼이 소유한다).
 *
 * 안내 문구가 필요한 이유: 이 선택이 곧 **대화의 개폐 스위치**다(20260914000400).
 * '처리 중'으로 두면 회원이 같은 접수번호에 답장할 수 있고, '답변 완료'면 스레드가
 * 닫혀 다시 열리지 않는다(`INQUIRY_STATUS_TRANSITIONS` 에 answered → in_progress 가
 * 없다). 운영자가 그 뜻을 모르고 고르면 회원은 답할 곳을 잃는다.
 */
export function InquiryReplyFooter({
  adminNickname,
  isPending,
  isDisabled,
  submitLabel,
  pendingLabel,
}: {
  adminNickname: string
  isPending: boolean
  /** 다른 운영자가 작성 중이면 제출도 막힌다(잠금 배너가 이유를 설명한다). */
  isDisabled: boolean
  submitLabel: string
  pendingLabel: string
}) {
  return (
    <div className="flex flex-col gap-2">
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
            /* 기본은 **처리 중**이다(오너 규칙 2026-09-14). 상수 순서에 기대지 않고
               값으로 못 박는다 — 목록 순서를 바꾸는 일이 기본값을 바꾸면 안 된다. */
            defaultValue="in_progress"
            aria-describedby={NEXT_STATUS_HINT_ID}
            className="rounded-panel border-line bg-surface text-ink focus:border-accent focus:outline-accent/40 h-9 border px-3 text-[13px] focus:outline-2"
          >
            {INQUIRY_REPLY_NEXT_STATUSES.map((status) => (
              <option key={status} value={status}>
                {INQUIRY_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <Button type="submit" disabled={isPending || isDisabled}>
            {isPending ? pendingLabel : submitLabel}
          </Button>
        </div>
      </div>

      <p id={NEXT_STATUS_HINT_ID} className="text-muted text-[12px] sm:text-right">
        처리 중: 회원이 이 문의에 답장할 수 있습니다 · 답변 완료: 대화가 닫히며 다시 열 수
        없습니다
      </p>
    </div>
  )
}
