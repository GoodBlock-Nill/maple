/**
 * DB 에서 온 정책 HTML 의 화면 서식.
 *
 * 값은 전부 `PolicySectionArticle` · `PolicyBlockView` 에서 그대로 가져왔다. 코드
 * 문안(폴백)과 DB 문안(발행본)이 **같은 화면**이어야 하기 때문이다. 한쪽만 고치면
 * 발행 전후로 글자 크기·간격이 튄다.
 *
 * 구조는 평평하다(h2/h3/h4 + p/ul/table). 에디터가 만들 수 있는 문서가 그것뿐이라
 * 계층을 감싸는 래퍼를 쓸 수 없고, 그래서 세로 간격을 flex `gap` 대신 인접 형제
 * 선택자(`[&>h2+*]`)로 준다. 결과 값은 같다 — flex 컨테이너에는 마진 상쇄가 없다.
 *
 * 관리자 미리보기(`admin/components/legal/legal-prose.ts`)가 이 파일의 사본을
 * 쓴다. 두 파일이 갈라지면 "미리보기와 실제 화면이 다른" 상태가 되므로 단위
 * 테스트가 표류를 감시한다.
 */

/** 표 가로 스크롤 상자. `PolicyBlockView` 의 표 래퍼와 같은 클래스다. */
export const POLICY_TABLE_WRAPPER_CLASS = 'border-line-soft rounded-panel overflow-x-auto border'

export const POLICY_PROSE_CLASS = [
  /* 본문 기본값 = PolicyBlockView 의 문단 클래스. p·li 가 이 값을 물려받는다. */
  'text-ink-muted text-[17px] leading-[1.8]',
  /* 블록 사이 = PolicySectionArticle 의 gap-4. */
  '[&>*+*]:mt-4',

  /* 장(章). 뒤따르는 본문은 mt-5, 다음 장까지는 카드의 gap-12 와 같은 12. */
  '[&>h2]:text-ink [&>h2]:scroll-mt-28 [&>h2]:text-[22px] [&>h2]:leading-tight [&>h2]:font-bold',
  'sm:[&>h2]:text-[27px]',
  '[&>*+h2]:mt-12',
  '[&>h2+p]:mt-5 [&>h2+ul]:mt-5 [&>h2+ol]:mt-5 [&>h2+div]:mt-5',

  /* 절(3-1 등). 본문 없이 곧바로 절이 오는 장은 원본에서 20(빈 본문 묶음) + 24 였다.
     그 두 값을 합친 11(44px)을 h2 바로 뒤 h3 에만 준다 — 나머지 절 사이는 8. */
  '[&>h3]:text-ink [&>h3]:scroll-mt-28 [&>h3]:text-[19px] [&>h3]:leading-normal [&>h3]:font-semibold',
  '[&>*+h3]:mt-8',
  '[&>h2+h3]:mt-11',
  '[&>h3+p]:mt-3 [&>h3+ul]:mt-3 [&>h3+ol]:mt-3 [&>h3+div]:mt-3',

  /* 항(가/나 등). 절 바로 뒤(본문 없는 절)는 12 + 20 = 8(32px). */
  '[&>h4]:text-ink-muted [&>h4]:scroll-mt-28 [&>h4]:text-[17px] [&>h4]:leading-normal [&>h4]:font-semibold',
  '[&>*+h4]:mt-6',
  '[&>h3+h4]:mt-8',
  '[&>h4+p]:mt-3 [&>h4+ul]:mt-3 [&>h4+ol]:mt-3 [&>h4+div]:mt-3',

  /* 목록. 안내 문구 바로 뒤에 오는 목록만 gap-2 로 붙인다(PolicyBlockView 의 list 블록). */
  '[&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-1',
  '[&_ol]:flex [&_ol]:list-decimal [&_ol]:flex-col [&_ol]:gap-1.5 [&_ol]:pl-5',
  '[&_li]:marker:text-line-soft [&_li]:pl-1 [&_li]:leading-[1.8]',
  "[&_ul>li]:list-disc [&_ul>li]:marker:content-['–_']",
  '[&>p+ul]:mt-2',
  '[&>p+ol]:mt-2',

  /* 조항 번호는 문단의 첫 `<strong>` 이다 — PolicyBlockView 가 주던 mr-1.5 를 그대로 준다. */
  '[&_strong]:text-ink [&_strong]:font-semibold',
  '[&_p>strong:first-child]:mr-1.5',
  '[&_em]:italic',
  '[&_a]:text-ink [&_a]:underline [&_a]:underline-offset-[3px]',

  /* 표 바로 앞 문단 = 표 안내문(캡션). 원본과 같이 15px 로 줄인다.
     표는 렌더 시점에 스크롤 상자 `<div>` 로 감싸이므로 선택자가 div 를 본다. */
  '[&>p:has(+div)]:text-[15px]',
  '[&>p+div]:mt-3',
  /* 표 안의 행간은 본문(1.8)이 아니라 기본값이다. PolicyBlockView 의 표는 본문
     문단 밖에 있어 leading 을 물려받지 않았다 — 그 상태를 그대로 되살린다. */
  '[&_table]:w-full [&_table]:min-w-[480px] [&_table]:border-collapse [&_table]:leading-normal [&_table]:text-center',
  /* 머리글 행은 `<thead>` 가 아니라 "`<th>` 를 가진 행"으로 알아본다. 에디터가
     저장하는 표에는 thead 가 없고(모든 행이 tbody 안이다) 시드본에는 있다 —
     두 형태가 같은 화면이어야 한다. */
  '[&_tr:has(th)]:bg-page-sub',
  '[&_th]:text-table-head [&_th]:border-table-line [&_th]:h-11 [&_th]:border-b [&_th]:px-3 [&_th]:text-[14px] [&_th]:font-medium [&_th]:whitespace-nowrap',
  '[&_tr:not(:has(th))]:text-table-body [&_tr:not(:has(th))]:h-12 [&_tr:not(:has(th))]:text-[14px]',
  '[&_td]:border-table-line [&_td]:border-t [&_td]:px-3 [&_td]:whitespace-nowrap',
  /* 에디터는 셀 안에 문단을 넣는다(`<td><p>…</p></td>`). 문단 기본 여백이 살아나면
     행 높이가 커지므로 셀 안에서만 눌러 둔다. */
  '[&_td>p]:m-0 [&_th>p]:m-0',
].join(' ')

const H2_PATTERN = /<h2>/gu
const TABLE_OPEN_PATTERN = /<table>/gu
const TABLE_CLOSE_PATTERN = /<\/table>/gu
const H2_CONTENT_PATTERN = /<h2(?:\s[^>]*)?>([\s\S]*?)<\/h2>/gu
const TAG_PATTERN = /<[^>]*>/gu

/** 목차 앵커 id. 문서 순서로만 정해지므로 저장된 HTML 이 무엇이든 같은 규칙이다. */
export function policySectionAnchor(index: number): string {
  return `section-${index + 1}`
}

/**
 * 저장된(정제 완료) HTML → 화면에 넣을 HTML.
 *
 * 두 가지만 한다.
 *  1. `<h2>` 에 문서 순서대로 앵커 id 를 붙인다 — 목차 링크의 대상이다.
 *  2. `<table>` 을 가로 스크롤 상자로 감싼다 — 표 자체에는 `overflow` 가 듣지 않아
 *     좁은 화면에서 표가 카드를 뚫고 나간다.
 *
 * 입력이 이미 `sanitizeLegalHtml()` 을 통과한 값이라는 전제 위에 서 있다. 그래서
 * 문자열 치환으로 충분하다 — 허용 목록에 속성 없는 `<h2>` · `<table>` 만 남고,
 * 표는 중첩될 수 없다(에디터·정제기 모두 중첩 표를 만들지 않는다).
 */
export function renderPolicyHtml(html: string): string {
  let index = 0

  return html
    .replace(H2_PATTERN, () => `<h2 id="${policySectionAnchor(index++)}">`)
    .replace(TABLE_OPEN_PATTERN, `<div class="${POLICY_TABLE_WRAPPER_CLASS}"><table>`)
    .replace(TABLE_CLOSE_PATTERN, '</table></div>')
}

export type PolicyTocEntry = {
  id: string
  label: string
}

/** 엔티티를 되돌린다. 목차는 텍스트 노드로 그리므로 원문 글자가 필요하다. */
function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;/gu, "'")
    .replace(/&amp;/gu, '&')
}

/** 본문 HTML → 목차. `renderPolicyHtml()` 과 같은 순서·같은 id 를 쓴다. */
export function policyTocEntries(html: string): readonly PolicyTocEntry[] {
  const entries: PolicyTocEntry[] = []

  for (const match of html.matchAll(H2_CONTENT_PATTERN)) {
    const label = decodeEntities((match[1] ?? '').replace(TAG_PATTERN, '')).trim()

    entries.push({ id: policySectionAnchor(entries.length), label })
  }

  return entries
}
