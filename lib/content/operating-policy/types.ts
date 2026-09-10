/**
 * 글자월드 운영정책 구조화 데이터 타입.
 *
 * `docs/26년9월18일_글자월드_운영정책_1차(수정).md` 를 그대로 옮기되, 원문을 마크다운
 * 렌더러에 통째로 넘기지 않고 섹션/문단/목록/표 단위로 나눠 담는다.
 * 원문의 `**굵게**` 표기는 문구 그대로 보존하고, 렌더링 시 `PolicyInlineText`
 * 가 그 부분만 강조 처리한다(전체 마크다운 파서는 사용하지 않는다).
 */

/** 문단 하나. `code` 는 `[1-1]` 처럼 조항 번호가 있을 때만 채운다. */
export type PolicyParagraphBlock = {
  readonly kind: 'paragraph'
  readonly code?: string
  readonly text: string
}

/** 불릿 목록. `intro` 는 목록 위에 오는 안내 문구(예: "대상 행위:"). */
export type PolicyListBlock = {
  readonly kind: 'list'
  readonly intro?: string
  readonly items: readonly string[]
}

/** 제재 기준표 등 표 하나. `code` 는 표 위 안내문에 조항 번호가 있을 때만 채운다. */
export type PolicyTableBlock = {
  readonly kind: 'table'
  readonly code?: string
  readonly caption?: string
  readonly headers: readonly string[]
  readonly rows: readonly (readonly string[])[]
}

export type PolicyBlock = PolicyParagraphBlock | PolicyListBlock | PolicyTableBlock

/** `###`/`####` 레벨 하위 항목. 표 안에 다시 하위 항목이 올 수 있어(예: 3-1 안의 가/나) 재귀 구조다. */
export type PolicySubsection = {
  readonly id: string
  readonly title: string
  readonly blocks: readonly PolicyBlock[]
  readonly subsections?: readonly PolicySubsection[]
}

/** `##` 레벨 장(章). 목차는 이 배열로부터 만든다. */
export type PolicySection = {
  readonly id: string
  readonly number: number
  readonly title: string
  readonly blocks: readonly PolicyBlock[]
  readonly subsections?: readonly PolicySubsection[]
}

/** 목차에는 없는 말미의 "부칙" — 번호 없이 본문 뒤에만 붙는다. */
export type PolicyAddendum = {
  readonly title: string
  readonly items: readonly string[]
}

/**
 * 문서 맨 앞의 고지 블록 — 원문 첫머리의 인용(`>`) 네 줄.
 *
 * 장(章)이 아니므로 `<h2>` 를 만들지 않는다. 목차는 `<h2>` 에서만 만들어지니
 * (`components/policy/policy-prose.ts`) 이 블록은 목차에 오르지 않고, 1장 앞에
 * 그대로 놓인다. 한 문단 안에서 줄만 나누는 이유는 원문이 한 덩어리 인용이기
 * 때문이다 — 네 개의 문단으로 쪼개면 줄 간격이 본문 문단 간격(16px)으로 벌어진다.
 */
export type PolicyNotice = {
  readonly lines: readonly string[]
}
