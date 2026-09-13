import { SECTION_01, SECTION_02 } from './operating-policy/section-01-02'
import { SECTION_03A } from './operating-policy/section-03a'
import { SECTION_03B_SUBSECTIONS } from './operating-policy/section-03b'
import { SECTION_04, SECTION_05 } from './operating-policy/section-04-05'
import { SECTION_06, SECTION_07 } from './operating-policy/section-06-07'
import { ADDENDUM, SECTION_08, SECTION_09 } from './operating-policy/section-08-09'

import type { PolicySection } from './operating-policy/types'

export type {
  PolicyAddendum,
  PolicyBlock,
  PolicyListBlock,
  PolicyNotice,
  PolicyParagraphBlock,
  PolicySection,
  PolicySubsection,
  PolicyTableBlock,
} from './operating-policy/types'

/**
 * `docs/26년9월18일_글자월드_운영정책_1차(수정본).md` 를 구조화한 데이터.
 *
 * 초안(`… 1차.md`)은 본문에서 "글자서버"라는 표기를 썼지만, 서비스 명칭은
 * "글자월드" 하나로 간다(운영자 확정). 새 수정본 md 도 [1-1]·2-1 에서 다시
 * "글자서버"로 되돌아간 오기가 있지만, 코드는 그 회귀를 따르지 않는다 — 문안
 * 대조 시 그 두 곳만은 md 와 다름을 의도적으로 남겨 둔다.
 */
export const OPERATING_POLICY_TITLE = '글자월드 운영정책'

/** 파일명(`26년9월18일_...`)에서 그대로 가져온 시행일. */
export const OPERATING_POLICY_EFFECTIVE_DATE = '2026년 9월 18일'

/**
 * 문서 버전 쿼리 파라미터. 개정본이 추가되면 버전 선택 UI가 이 값을 늘린다.
 * `-2`: 1차 수정본(2026-09-18, 시행일은 그대로 9/18).
 *       첫머리 지식재산권 고지 블록 추가, 3-2 가 2차 제재 `900일 → 90일` 오기 정정,
 *       3-7 다 제재를 `영구 이용제한 + 수사 의뢰 검토` → `영구 이용제한` 으로 정리,
 *       본문 표기를 "글자서버" → "글자월드" 로 통일.
 * `-3`: 1차 수정본 반영(2026-09-18, 시행일은 그대로 9/18).
 *       첫머리 IP 고지 블록 제거(사이트 푸터로 이동, 본문에서는 뺌),
 *       8장 "아동·청소년 보호정책" 전체 삭제, 9·10장을 8·9장으로 재번호.
 */
export const OPERATING_POLICY_VERSION = '20260918-3'

export const OPERATING_POLICY_SECTIONS: readonly PolicySection[] = [
  SECTION_01,
  SECTION_02,
  {
    ...SECTION_03A,
    subsections: [...(SECTION_03A.subsections ?? []), ...SECTION_03B_SUBSECTIONS],
  },
  SECTION_04,
  SECTION_05,
  SECTION_06,
  SECTION_07,
  SECTION_08,
  SECTION_09,
]

export const OPERATING_POLICY_ADDENDUM = ADDENDUM
