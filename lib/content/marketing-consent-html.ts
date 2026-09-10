import { MARKETING_CONSENT_SECTIONS } from '@/lib/content/marketing-consent'
import { policySectionsToHtml } from '@/lib/content/policy-to-html'

/**
 * 코드 문안(`MARKETING_CONSENT_SECTIONS`)을 발행본과 같은 HTML 로 바꾼다.
 *
 * 회원가입 모달은 문서를 **한 가지 방법으로만** 그린다 — 발행본이 있으면 그 HTML,
 * 없으면 이 폴백 HTML. 두 갈래로 그리면(HTML 한 벌 + 리액트 컴포넌트 한 벌)
 * 발행 전후로 서식이 달라지고, 정책 문안 전체가 클라이언트 번들에 실린다.
 *
 * 결과는 입력이 상수라 항상 같다. 요청마다 다시 만들지 않도록 한 번만 계산한다.
 */
let cached: string | undefined

export function marketingConsentFallbackHtml(): string {
  cached ??= policySectionsToHtml({ sections: MARKETING_CONSENT_SECTIONS })

  return cached
}
