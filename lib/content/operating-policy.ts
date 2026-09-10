import { OPERATING_POLICY_NOTICE } from './operating-policy/notice'
import { SECTION_01, SECTION_02 } from './operating-policy/section-01-02'
import { SECTION_03A } from './operating-policy/section-03a'
import { SECTION_03B_SUBSECTIONS } from './operating-policy/section-03b'
import { SECTION_04, SECTION_05 } from './operating-policy/section-04-05'
import { SECTION_06, SECTION_07 } from './operating-policy/section-06-07'
import { SECTION_08, SECTION_09 } from './operating-policy/section-08-09'
import { ADDENDUM, SECTION_10 } from './operating-policy/section-10'

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
 * `docs/26년9월18일_글자월드_운영정책_1차(수정).md` 를 구조화한 데이터.
 *
 * 초안(`… 1차.md`)은 본문에서 "글자서버"라는 표기를 썼지만, 서비스 명칭은
 * "글자월드" 하나로 간다(운영자 확정). 원문 문서 파일도 같은 표기로 맞춰 두었으니
 * 두 벌이 갈라질 일은 없다 — 문안 대조는 그 파일 하나만 보면 된다.
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
 */
export const OPERATING_POLICY_VERSION = '20260918-2'

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
  SECTION_10,
]

export const OPERATING_POLICY_ADDENDUM = ADDENDUM

export { OPERATING_POLICY_NOTICE }
