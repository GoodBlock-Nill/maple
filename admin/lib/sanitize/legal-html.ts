import sanitizeHtml from 'sanitize-html'

/**
 * 약관·정책 본문(HTML) 정제기 — 사용자 사이트 `lib/sanitize/legal-html.ts` 의 사본.
 *
 * 관리자가 저장한 값을 사용자 사이트가 그대로 렌더한다. 허용 목록이 갈라지면
 * 두 방향으로 깨진다 — 관리자가 넣었는데 독자 화면에서 사라지거나, 저장할 수
 * 없는데 화면은 허용하거나. 두 파일은 항상 함께 고친다.
 *
 * 커뮤니티 본문(`lib/sanitize/post-html.ts`)과 **별도의 허용 목록**을 쓴다. 정책
 * 문서는 표가 본문의 절반을 차지하지만(제재 기준표·수집 항목표) 이미지·영상은
 * 한 장도 없다. 두 문서 종류를 한 허용 목록에 욱여넣으면 커뮤니티 글에도 표가
 * 열리거나, 정책에 트래킹 픽셀을 심을 수 있게 된다.
 *
 * 신뢰 경계는 하나다 — 관리자 저장 액션이 이 함수를 통과시킨 문자열만 DB 에
 * 들어가고, 사용자 사이트는 그 값을 그대로 `dangerouslySetInnerHTML` 로 그린다.
 *
 * `id` 는 허용하지 않는다. 목차 앵커는 렌더 시점에
 * `components/policy/policy-prose.ts` 가 문서 순서대로 다시 붙인다 — 에디터가
 * 속성을 버려도 목차가 죽지 않게 하려는 것이다.
 */

/** 허용 태그. 여기 없는 태그는 전부 벗겨진다(내용 텍스트는 남는다). */
const LEGAL_ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  /* h4 까지 여는 이유: 원문에 `3-7 > 가.` 같은 3단 계층이 실제로 있다.
     에디터도 같은 세 단계를 만들 수 있어야 한다(admin/components/editor). */
  'h2',
  'h3',
  'h4',
  'ul',
  'ol',
  'li',
  'a',
  'table',
  'thead',
  'tbody',
  'tr',
  'th',
  'td',
] as const

/** 허용 목록 밖으로 밀어내는 임시 태그. span 은 허용 목록에 없어 통째로 벗겨진다. */
const DROP_TAG = 'span'

const LINK_REL = 'noopener noreferrer nofollow'
const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/iu

function legalLinkAttributes(attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  const href = (attribs.href ?? '').trim()

  if (!HTTP_URL_PATTERN.test(href)) {
    return { tagName: DROP_TAG, attribs: {} }
  }

  /* rel·target 은 작성자가 무엇을 보냈든 우리 값으로 덮어쓴다. target="_blank" 만
     있고 rel 이 없으면 새 창이 opener 를 통해 원본 탭을 조작할 수 있다. */
  return { tagName: 'a', attribs: { href, rel: LINK_REL, target: '_blank' } }
}

function buildLegalOptions(): sanitizeHtml.IOptions {
  return {
    allowedTags: [...LEGAL_ALLOWED_TAGS],
    /* 허용하지 않은 속성은 전부 사라진다 — style·class·colspan·on* 이벤트 포함.
       colspan 을 열지 않는 이유: 렌더 규칙(고정 행 높이·가운데 정렬)이 병합 셀을
       가정하지 않아, 열어 두면 관리자 미리보기와 사용자 화면이 갈라진다. */
    allowedAttributes: { a: ['href', 'rel', 'target'] },
    allowedSchemes: ['http', 'https'],
    /* `//evil.example` 처럼 스킴이 생략된 주소는 현재 페이지 스킴을 물려받아
       허용 목록을 우회한다. 프로토콜 상대 URL 자체를 막는다. */
    allowProtocolRelative: false,
    allowedSchemesAppliedToAttributes: ['href'],
    /* 기본값(script·style·textarea·option)에 더해 내용까지 통째로 버릴 태그. */
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template', 'iframe'],
    transformTags: {
      a: (_tagName, attribs) => legalLinkAttributes(attribs),
    },
    parser: { lowerCaseTags: true, lowerCaseAttributeNames: true },
  }
}

/**
 * 에디터는 블록 노드 뒤에 항상 빈 문단을 하나 붙여 둔다(그래야 표 아래에 글을 쓸 수
 * 있다). 저장까지 따라가면 문서 끝에 빈 줄이 남으므로 여기서 걷어낸다.
 */
const TRAILING_EMPTY_PARAGRAPHS = /(?:<p><\/p>)+$/u

/** 저장 직전에 반드시 통과시킨다. 출력만이 DB 와 화면이 신뢰하는 값이다. */
export function sanitizeLegalHtml(html: string): string {
  return sanitizeHtml(html, buildLegalOptions()).trim().replace(TRAILING_EMPTY_PARAGRAPHS, '')
}
