import { SECTION_01, SECTION_02, SECTION_03 } from './privacy-policy/section-01-03'
import { SECTION_04, SECTION_05, SECTION_06, SECTION_07 } from './privacy-policy/section-04-07'
import { SECTION_08, SECTION_09, SECTION_10 } from './privacy-policy/section-08-10'
import { SECTION_11, SECTION_12, SECTION_13 } from './privacy-policy/section-11-13'

import type { PolicySection } from './operating-policy/types'

export type {
  PolicyBlock,
  PolicyListBlock,
  PolicyParagraphBlock,
  PolicySection,
  PolicySubsection,
  PolicyTableBlock,
} from './operating-policy/types'

/**
 * 글자월드 개인정보처리방침 구조화 데이터.
 *
 * `PolicySection`/`PolicyBlock` 타입과 렌더러(`components/policy/*`)는
 * `lib/content/operating-policy.ts` 와 동일하게 재사용한다. 조문의 `①②③`
 * 번호는 각 블록의 `code` 필드에 담는다.
 */
export const PRIVACY_POLICY_TITLE = '글자월드 개인정보처리방침'

export const PRIVACY_POLICY_EFFECTIVE_DATE = '2026년 9월 18일'

/**
 * 문서 버전 쿼리 파라미터. 개정본이 추가되면 버전 선택 UI가 이 값을 늘린다.
 * `-2`: 회원 탈퇴 90일 보존·파기 규정 추가(2026-09-09, 시행일은 그대로 9/18).
 * `-3`: 개인정보 보호책임자 연락처 변경(2026-09-10, 시행일은 그대로 9/18).
 * `-4`: 사이트 전역 문의 이메일을 `care@gjstory.com` 으로 통일(2026-09-10, 시행일은 그대로 9/18).
 *       §12 본문 표기는 `-3` 에서 이미 `care@gjstory.com` 으로 바뀌어 문안 자체는 그대로다 —
 *       이 버전은 사이트 전역(`CONTACT_EMAIL` 등) 변경이 마무리됐다는 발행 이력을 남긴다.
 */
export const PRIVACY_POLICY_VERSION = '20260918-4'

export const PRIVACY_POLICY_SECTIONS: readonly PolicySection[] = [
  SECTION_01,
  SECTION_02,
  SECTION_03,
  SECTION_04,
  SECTION_05,
  SECTION_06,
  SECTION_07,
  SECTION_08,
  SECTION_09,
  SECTION_10,
  SECTION_11,
  SECTION_12,
  SECTION_13,
]
