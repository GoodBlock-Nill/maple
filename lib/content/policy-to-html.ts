import type {
  PolicyAddendum,
  PolicyBlock,
  PolicyNotice,
  PolicySection,
  PolicySubsection,
} from '@/lib/content/operating-policy/types'

/**
 * 구조화된 정책 문서(`PolicySection[]`) → 저장용 HTML.
 *
 * **왜 필요한가.** 정책 문안은 원래 코드 안의 구조체였다. 관리자에서 고칠 수 있게
 * 하려면 DB 에 넣어야 하고, 위지윅 에디터가 다룰 수 있는 형식은 HTML 하나뿐이다.
 * 이 변환기는 최초 시드(마이그레이션)를 만드는 도구이자, "코드 문안 = DB 문안"이
 * 같은 값임을 단위 테스트로 못 박는 기준점이다.
 *
 * **평평한 HTML 인 이유.** 에디터(Tiptap)의 문서 스키마는 중첩 래퍼를 표현하지
 * 못한다. `<div>` 로 감싸 두면 운영자가 한 번 저장하는 순간 조용히 사라져 문서가
 * 재구조화된다. 그래서 제목 레벨(h2/h3/h4)만으로 계층을 표현하고, 화면 서식은
 * 렌더 시점의 클래스 규칙(`components/policy/policy-prose.ts`)이 맡는다.
 *
 * 출력 태그는 `lib/sanitize/legal-html.ts` 의 허용 목록 안에서만 고른다.
 */

/**
 * 텍스트 노드에 필요한 최소 이스케이프 — `&` · `<` · `>` 뿐이다.
 *
 * 따옴표는 건드리지 않는다. 여기서 만드는 문자열은 **속성값이 되는 일이 없고**,
 * `&quot;` 로 바꿔 두면 정제기가 다시 `"` 로 되돌려 놓아 "변환기 출력 ≠ 저장값"이
 * 된다. 그 한 글자 차이가 시드본과 관리자 저장본을 갈라놓는다.
 * 정책 문안에는 부등호가 실제로 등장하므로(예: 인용 부호 안의 `<`) 나머지 셋은 꼭 필요하다.
 */
export function escapeHtml(value: string): string {
  return value.replace(/&/gu, '&amp;').replace(/</gu, '&lt;').replace(/>/gu, '&gt;')
}

const BOLD_PATTERN = /\*\*(.+?)\*\*/gu

/**
 * 원문의 `**굵게**` 표기 → `<strong>`.
 *
 * 전체 마크다운을 파싱하지 않는다(`lib/utils/policy-text.ts` 와 같은 규칙이다).
 * 이스케이프를 **먼저** 하면 `**` 가 그대로 남으므로 순서를 뒤집지 않는다.
 */
export function inlineToHtml(text: string): string {
  return escapeHtml(text).replace(
    BOLD_PATTERN,
    (_match, inner: string) => `<strong>${inner}</strong>`,
  )
}

/**
 * 제목에 `id` 를 넣지 않는다.
 *
 * 목차 앵커는 렌더 시점에 `renderPolicyHtml()` 이 문서 순서대로 다시 붙인다
 * (`section-1`, `section-2` …). 저장된 HTML 에 id 를 담아 두면 에디터가 그 속성을
 * 버리는 순간(Tiptap 의 heading 노드는 id 를 모른다) 목차 링크가 조용히 죽는다.
 * 붙이는 쪽을 한 곳으로 몰아 두면 시드본이든 운영자가 고친 본이든 규칙이 같다.
 */
function heading(level: 2 | 3 | 4, text: string): string {
  return `<h${level}>${inlineToHtml(text)}</h${level}>`
}

/**
 * 조항 번호(`[1-1]` · `①`)는 문단 첫 자식 `<strong>` 으로 나간다.
 *
 * 공백을 넣지 않는다. `PolicyBlockView` 는 이 자리에 `mr-1.5`(6px) 를 주므로,
 * 공백 문자를 끼우면 간격이 4px 대로 줄어 원래 화면과 어긋난다. 렌더 규칙이
 * `p > strong:first-child` 로 같은 여백을 다시 준다.
 */
function codePrefix(code: string | undefined): string {
  return code === undefined ? '' : `<strong>${escapeHtml(code)}</strong>`
}

function listToHtml(items: readonly string[]): string {
  return `<ul>${items.map((item) => `<li>${inlineToHtml(item)}</li>`).join('')}</ul>`
}

function tableToHtml(headers: readonly string[], rows: readonly (readonly string[])[]): string {
  const head = headers.map((header) => `<th>${inlineToHtml(header)}</th>`).join('')
  const body = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${inlineToHtml(cell)}</td>`).join('')}</tr>`)
    .join('')

  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`
}

function blockToHtml(block: PolicyBlock): string {
  if (block.kind === 'paragraph') {
    return `<p>${codePrefix(block.code)}${inlineToHtml(block.text)}</p>`
  }

  if (block.kind === 'list') {
    const intro = block.intro === undefined ? '' : `<p>${inlineToHtml(block.intro)}</p>`

    return `${intro}${listToHtml(block.items)}`
  }

  /* 표 위 안내문은 별도 문단으로 앞세운다. 렌더 규칙이 "표 바로 앞 문단"을
     캡션으로 알아보고 15px 로 줄인다(`p:has(+ div)`). */
  const caption =
    block.code === undefined && block.caption === undefined
      ? ''
      : `<p>${codePrefix(block.code)}${block.caption === undefined ? '' : inlineToHtml(block.caption)}</p>`

  return `${caption}${tableToHtml(block.headers, block.rows)}`
}

function subsectionToHtml(subsection: PolicySubsection, depth: number): string {
  /* depth 0 = `3-1` 같은 절, depth 1 = `가.`/`나.` 같은 항. 더 깊은 계층은 원문에
     없으므로 h4 로 눌러 담는다 — h5 는 목차·서식 규칙이 다루지 않는다. */
  const level = depth === 0 ? 3 : 4
  const blocks = subsection.blocks.map(blockToHtml).join('')
  const children = (subsection.subsections ?? [])
    .map((child) => subsectionToHtml(child, depth + 1))
    .join('')

  return `${heading(level, subsection.title)}${blocks}${children}`
}

function sectionToHtml(section: PolicySection): string {
  const blocks = section.blocks.map(blockToHtml).join('')
  const children = (section.subsections ?? [])
    .map((subsection) => subsectionToHtml(subsection, 0))
    .join('')

  return `${heading(2, `${section.number}. ${section.title}`)}${blocks}${children}`
}

/**
 * 부칙은 원래 목차 밖의 꼬리말이었지만, HTML 로 옮기면 "번호 없는 장"이 된다.
 * 목차에도 함께 실린다 — 운영자가 에디터에서 h2 를 하나 더 만든 것과 구분할
 * 방법이 없고, 구분하려 들면 규칙이 문서마다 갈라진다.
 */
function addendumToHtml(addendum: PolicyAddendum): string {
  return `${heading(2, addendum.title)}${listToHtml(addendum.items)}`
}

/**
 * 첫머리 고지는 **한 문단 + `<br />`** 이다.
 *
 * 줄마다 `<p>` 를 따로 두면 본문 문단 간격(16px)이 네 번 들어가 인용 한 덩어리가
 * 네 개의 문단으로 흩어진다. 제목을 붙이지 않는 것도 의도다 — `<h2>` 를 만들면
 * `policyTocEntries()` 가 목차 맨 앞에 "고지"를 한 줄 올려 원문에 없는 장이 생긴다.
 */
function noticeToHtml(notice: PolicyNotice): string {
  return `<p>${notice.lines.map(inlineToHtml).join('<br />')}</p>`
}

export type PolicyHtmlInput = {
  sections: readonly PolicySection[]
  /** 1장 앞에 오는 고지 블록(운영정책의 넥슨·Toben 지식재산권 고지). */
  notice?: PolicyNotice
  addendum?: PolicyAddendum
}

export function policySectionsToHtml({ sections, notice, addendum }: PolicyHtmlInput): string {
  const head = notice === undefined ? '' : noticeToHtml(notice)
  const body = sections.map(sectionToHtml).join('')
  const tail = addendum === undefined ? '' : addendumToHtml(addendum)

  return `${head}${body}${tail}`
}
