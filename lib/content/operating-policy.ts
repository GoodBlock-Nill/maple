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
  PolicyParagraphBlock,
  PolicySection,
  PolicySubsection,
  PolicyTableBlock,
} from './operating-policy/types'

/**
 * `docs/26년9월18일_글자월드_운영정책 1차.md` 를 구조화한 데이터.
 *
 * 원문은 "글자서버"라는 표기를 쓰지만(당시 초안 명칭), 페이지 타이틀/헤딩은
 * 사이트 표기인 "글자월드"를 쓴다(사용자 요청). 본문 문구 자체는 원문 그대로
 * 옮겨 "글자서버"가 남아 있을 수 있다 — 실제 약관 문안이므로 임의로 고치지 않는다.
 */
export const OPERATING_POLICY_TITLE = '글자월드 운영정책'

/** 파일명(`26년9월18일_...`)에서 그대로 가져온 시행일. */
export const OPERATING_POLICY_EFFECTIVE_DATE = '2026년 9월 18일'

/** 문서 버전 쿼리 파라미터. 개정본이 추가되면 버전 선택 UI가 이 값을 늘린다. */
export const OPERATING_POLICY_VERSION = '20260918'

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
