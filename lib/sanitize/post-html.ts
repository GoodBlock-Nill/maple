import sanitizeHtml from 'sanitize-html'

import { requireEnv } from '@/lib/supabase/env'
import { postImagePublicUrlPrefix } from '@/lib/supabase/storage'
import { parseVideoToken, toVideoToken } from '@/lib/utils/video-embed'

/**
 * 커뮤니티 본문(HTML) 정제기.
 *
 * **`sanitize-html` 을 고른 이유.** 후보는 `isomorphic-dompurify` 였다. 그쪽은
 * 서버에서 돌기 위해 `jsdom` 을 통째로 끌고 온다 — 번들이 수십 MB 커지고 서버리스
 * 배포에서 콜드 스타트가 눈에 띄게 느려진다. `sanitize-html` 은 `htmlparser2`
 * 기반이라 DOM 이 필요 없고, 무엇보다 **속성값 단위 검사**(`transformTags`)를
 * 선언적으로 쓸 수 있다. 우리에게는 이게 핵심이다 — img 는 우리 스토리지 공개 URL
 * 접두사로 시작할 때만, a 는 http(s) 일 때만 살려야 하기 때문이다.
 *
 * **신뢰 경계.** 이 함수의 출력만이 DB 에 저장되고, 그 출력만이 화면에
 * `dangerouslySetInnerHTML` 로 들어간다. 클라이언트가 무엇을 보냈든 여기서
 * 다시 깎으므로 에디터를 우회한 직접 POST 도 같은 규칙을 받는다.
 *
 * **영상은 iframe 으로 저장하지 않는다.** `<div data-video="youtube:<id>">`
 * 자리표시자만 남기고, 실제 iframe 은 표시 시점에 `renderPostHtml()` 이 조립한다.
 * 저장된 iframe 을 믿는 순간 src·allow·sandbox 를 전부 신뢰해야 하고, 정책을
 * 바꿔도 과거 글은 옛 속성을 그대로 들고 있게 된다.
 */

/** 허용 태그. 여기 없는 태그는 전부 벗겨진다(내용 텍스트는 남는다). */
const ALLOWED_TAGS = [
  'p',
  'br',
  'strong',
  'em',
  's',
  'u',
  'h2',
  'h3',
  'ul',
  'ol',
  'li',
  'blockquote',
  'a',
  'img',
  /* 영상 자리표시자 전용. data-video 가 없거나 형식이 틀리면 span 으로 바뀌어 사라진다. */
  'div',
] as const

/** 허용 목록 밖으로 밀어내는 임시 태그. span 은 ALLOWED_TAGS 에 없어 통째로 벗겨진다. */
const DROP_TAG = 'span'

const LINK_REL = 'noopener noreferrer nofollow'
const HTTP_URL_PATTERN = /^https?:\/\/[^\s]+$/iu
const DIMENSION_PATTERN = /^\d{1,4}$/u

export type SanitizePostHtmlOptions = {
  /**
   * 허용할 이미지 URL 접두사. 기본값은 `post-images` 버킷의 공개 URL 접두사다.
   * 테스트는 환경 변수 없이 돌아야 하므로 주입할 수 있게 열어 둔다.
   */
  imageUrlPrefix?: string
}

function defaultImageUrlPrefix(): string {
  /* NEXT_PUBLIC_* 은 정적 치환이라 리터럴로 읽어야 한다(lib/supabase/env.ts 주석 참고). */
  return postImagePublicUrlPrefix(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
  )
}

/** 숫자만 남긴다. `width="100%"` 같은 값은 레이아웃을 깨뜨리므로 버린다. */
function keepDimension(
  name: 'width' | 'height',
  value: string | undefined,
): Record<string, string> {
  return value !== undefined && DIMENSION_PATTERN.test(value) ? { [name]: value } : {}
}

function imageAttributes(attribs: sanitizeHtml.Attributes, prefix: string): sanitizeHtml.Tag {
  const src = attribs.src ?? ''

  /* 우리 버킷 밖의 이미지는 통째로 버린다. 외부 URL 을 허용하면 본문이 조회
     추적기(트래킹 픽셀)가 되고, 원본이 사라지면 글이 깨진 채로 남는다. */
  if (!src.startsWith(prefix)) {
    return { tagName: DROP_TAG, attribs: {} }
  }

  return {
    tagName: 'img',
    attribs: {
      src,
      alt: attribs.alt ?? '',
      ...keepDimension('width', attribs.width),
      ...keepDimension('height', attribs.height),
    },
  }
}

function linkAttributes(attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  const href = (attribs.href ?? '').trim()

  if (!HTTP_URL_PATTERN.test(href)) {
    return { tagName: DROP_TAG, attribs: {} }
  }

  /* rel·target 은 작성자가 무엇을 보냈든 우리 값으로 덮어쓴다.
     target="_blank" 만 있고 rel 이 없으면 새 창이 opener 를 통해 원본 탭을 조작할 수 있다. */
  return { tagName: 'a', attribs: { href, rel: LINK_REL, target: '_blank' } }
}

function videoAttributes(attribs: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  const embed = parseVideoToken(attribs['data-video'] ?? '')

  return embed === null
    ? { tagName: DROP_TAG, attribs: {} }
    : { tagName: 'div', attribs: { 'data-video': toVideoToken(embed) } }
}

function buildOptions(prefix: string): sanitizeHtml.IOptions {
  return {
    allowedTags: [...ALLOWED_TAGS],
    /* 허용하지 않은 속성은 전부 사라진다 — style·class·on* 이벤트 핸들러 포함. */
    allowedAttributes: {
      a: ['href', 'rel', 'target'],
      img: ['src', 'alt', 'width', 'height'],
      div: ['data-video'],
    },
    allowedSchemes: ['http', 'https'],
    allowedSchemesByTag: { img: ['https'] },
    /* `//evil.example` 처럼 스킴이 생략된 주소는 현재 페이지 스킴을 물려받아
       허용 목록을 우회한다. 프로토콜 상대 URL 자체를 막는다. */
    allowProtocolRelative: false,
    allowedSchemesAppliedToAttributes: ['href', 'src'],
    /* 기본값(script·style·textarea·option)에 더해 내용까지 통째로 버릴 태그. */
    nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'template', 'iframe'],
    transformTags: {
      a: (_tagName, attribs) => linkAttributes(attribs),
      img: (_tagName, attribs) => imageAttributes(attribs, prefix),
      div: (_tagName, attribs) => videoAttributes(attribs),
    },
    parser: { lowerCaseTags: true, lowerCaseAttributeNames: true },
  }
}

/**
 * 에디터는 블록 노드 뒤에 항상 빈 문단을 하나 붙여 둔다(그래야 영상 아래에 글을 쓸 수
 * 있다). 저장까지 따라가면 상세 화면 끝에 빈 줄이 남으므로 여기서 걷어낸다.
 */
const TRAILING_EMPTY_PARAGRAPHS = /(?:<p><\/p>)+$/u

/** 저장 직전에 반드시 통과시킨다. 출력만이 DB 와 화면이 신뢰하는 값이다. */
export function sanitizePostHtml(html: string, options: SanitizePostHtmlOptions = {}): string {
  const prefix = options.imageUrlPrefix ?? defaultImageUrlPrefix()

  return sanitizeHtml(html, buildOptions(prefix)).trim().replace(TRAILING_EMPTY_PARAGRAPHS, '')
}
