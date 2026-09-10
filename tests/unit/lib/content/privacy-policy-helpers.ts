import { PRIVACY_POLICY_SECTIONS } from '@/lib/content/privacy-policy'

import type {
  PolicyBlock,
  PolicyListBlock,
  PolicySection,
  PolicySubsection,
  PolicyTableBlock,
} from '@/lib/content/privacy-policy'

/**
 * 개인정보처리방침 문안 테스트가 함께 쓰는 조회 도구.
 *
 * 조문(`제n조`)을 번호로 집어 텍스트·표·목록만 뽑아 본다. 두 테스트 파일
 * (`privacy-policy.test.ts` · `privacy-policy-articles.test.ts`)이 같은 규칙으로
 * 문서를 읽어야 "한쪽만 통과하는" 단언이 생기지 않는다.
 */

/** 원문(`docs/개인정보처리방침_글자월드_v1_0.pdf`)의 조문 제목 14개. */
export const ARTICLE_TITLES = [
  '개인정보의 처리 목적',
  '처리하는 개인정보의 항목 및 수집 방법',
  '개인정보의 처리 및 보유기간',
  '개인정보의 제3자 제공',
  '개인정보 처리업무의 위탁',
  '개인정보의 국외 이전',
  '개인정보의 파기 절차 및 방법',
  '이용자와 법정대리인의 권리·의무 및 행사방법',
  '만 14세 미만 아동의 개인정보',
  '개인정보의 안전성 확보조치',
  '쿠키의 이용 및 거부',
  '개인정보 보호책임자 및 열람청구',
  '권익침해 구제방법',
  '개인정보처리방침의 변경',
]

/** 블록 하나에서 화면에 그려지는 모든 텍스트를 모은다. */
export function collectBlockText(block: PolicyBlock): string[] {
  if (block.kind === 'paragraph') {
    return [block.text]
  }

  if (block.kind === 'list') {
    return [...(block.intro !== undefined ? [block.intro] : []), ...block.items]
  }

  return [
    ...(block.caption !== undefined ? [block.caption] : []),
    ...block.headers,
    ...block.rows.flat(),
  ]
}

/** 하위 항목(subsection)까지 재귀적으로 순회하며 텍스트를 모은다. */
export function collectSubsectionText(subsection: PolicySubsection): string[] {
  return [
    subsection.title,
    ...subsection.blocks.flatMap(collectBlockText),
    ...(subsection.subsections ?? []).flatMap(collectSubsectionText),
  ]
}

export function collectSectionText(section: PolicySection): string[] {
  return [
    section.title,
    ...section.blocks.flatMap(collectBlockText),
    ...(section.subsections ?? []).flatMap(collectSubsectionText),
  ]
}

/** `제n조`. 없으면 곧바로 실패시킨다 — 옵셔널 체이닝으로 조용히 넘어가면 안 된다. */
export function article(number: number): PolicySection {
  const found = PRIVACY_POLICY_SECTIONS.find((entry) => entry.number === number)

  if (found === undefined) {
    throw new Error(`제${number}조가 없습니다.`)
  }

  return found
}

/** `제n조`의 모든 텍스트(제목 · 문단 · 목록 · 표 · 하위 항목). */
export function textOf(number: number): string {
  return collectSectionText(article(number)).join('\n')
}

export function tablesOf(number: number): PolicyTableBlock[] {
  return article(number).blocks.filter((block) => block.kind === 'table')
}

export function listsOf(number: number): PolicyListBlock[] {
  return article(number).blocks.filter((block) => block.kind === 'list')
}
