/**
 * '회원 답장 도착만' 체크박스.
 *
 * GET 폼의 한 칸이라 **꺼지면 아무것도 보내지 않는다** — 그래서 파서는 `'1'` 하나만
 * 참으로 읽는다(`parseInquiryAwaitingParam`). 숨은 값으로 `0` 을 함께 보내는 흔한
 * 수법은 쓰지 않는다. 주소에 `awaiting=0` 이 남으면 "필터가 걸린 화면"처럼 보인다.
 *
 * 필터 폼에서 떼어 낸 것은 `InquiryFilters` 가 컴포넌트 상한(200줄)에 닿았기
 * 때문이다(담당자 필터를 뗀 것과 같은 이유).
 */
export function InquiryAwaitingFilter({ checked }: { checked: boolean }) {
  return (
    <label className="text-ink flex h-10 items-center gap-2 text-[13px] font-semibold">
      <input
        type="checkbox"
        name="awaiting"
        value="1"
        defaultChecked={checked}
        className="accent-accent size-4"
      />
      회원 답장 도착만
    </label>
  )
}
