import { CONTROL_CLASS } from '@/components/inquiries/inquiry-filter-controls'

/**
 * 등록일 기간 필터(시작일 ~ 종료일).
 *
 * 두 칸이 한 뜻이라 라벨 하나 아래 묶는다. 필터 폼에서 떼어 낸 것은
 * `InquiryFilters` 가 컴포넌트 상한(200줄)에 닿았기 때문이다.
 *
 * 값은 `YYYY-MM-DD` 그대로 오간다 — 경계를 한국시간 자정으로 환산하는 일은 데이터
 * 계층(`applyInquiryFilters`)이 한 곳에서 한다.
 */
export function InquiryDateRangeFilter({ from, to }: { from: string | null; to: string | null }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-ink text-[13px] font-semibold">등록일</span>
      <span className="flex items-center gap-1.5">
        <input
          type="date"
          name="from"
          aria-label="시작일"
          defaultValue={from ?? ''}
          className={CONTROL_CLASS}
        />
        <span className="text-muted text-[13px]">~</span>
        <input
          type="date"
          name="to"
          aria-label="종료일"
          defaultValue={to ?? ''}
          className={CONTROL_CLASS}
        />
      </span>
    </label>
  )
}
