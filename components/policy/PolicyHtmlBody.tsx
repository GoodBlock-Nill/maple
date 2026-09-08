import { POLICY_PROSE_CLASS, renderPolicyHtml } from '@/components/policy/policy-prose'

type PolicyHtmlBodyProps = {
  /** `sanitizeLegalHtml()` 을 통과한 발행본 본문. */
  html: string
}

/**
 * DB 발행본 본문.
 *
 * `dangerouslySetInnerHTML` 은 의도된 선택이다. 여기 오는 문자열은 저장 시점과
 * 조회 시점(`lib/data/legal.ts`)에서 두 번 정제된 값이고, `renderPolicyHtml()` 은
 * 앵커 id 와 표 스크롤 상자만 덧붙인다 — 새 태그를 들여오지 않는다.
 */
export function PolicyHtmlBody({ html }: PolicyHtmlBodyProps) {
  return (
    <div
      className={POLICY_PROSE_CLASS}
      dangerouslySetInnerHTML={{ __html: renderPolicyHtml(html) }}
    />
  )
}
