import { parseVideoToken, videoEmbedSrc, videoEmbedTitle } from '@/lib/sanitize/video-embed'

/**
 * 저장된 본문 HTML → **표시용** HTML. 사용자 사이트 `lib/utils/post-html.ts` 의 사본.
 *
 * 관리자 미리보기가 사용자 화면과 같은 마크업을 그리게 하려면 이 변환도 같아야
 * 한다. 정제기가 남긴 영상 자리표시자(`<div data-video="...">`)를 iframe 으로
 * 조립하는 것은 **표시 시점**의 일이고, 저장된 값에는 iframe 이 없다.
 *
 * `sanitize-html` 을 끌어들이지 않는 이유: 이 모듈은 클라이언트 번들에도 실릴 수
 * 있어야 하고, 여기 있는 정규식은 임의의 HTML 이 아니라 `sanitizePostHtml()` 의
 * 출력만 상대한다(속성값의 `<`·`>`·`"` 가 이미 이스케이프되어 있다).
 */

/** 정제기가 남기는 자리표시자. 속성 순서·따옴표까지 정제기 출력과 1:1 로 맞춘다. */
const VIDEO_PLACEHOLDER_PATTERN = /<div data-video="([^"]*)"><\/div>/gu

const BLOCK_TAG_PATTERN = /<\/?(?:p|div|h2|h3|ul|ol|li|blockquote|br)\b[^>]*>/giu
const ANY_TAG_PATTERN = /<[^>]*>/gu
const WHITESPACE_PATTERN = /\s+/gu

/** `&amp;` 는 가장 마지막에 풀어야 `&amp;lt;` 가 `<` 로 잘못 되살아나지 않는다. */
const ENTITIES: readonly (readonly [RegExp, string])[] = [
  [/&nbsp;/gu, ' '],
  [/&lt;/gu, '<'],
  [/&gt;/gu, '>'],
  [/&quot;/gu, '"'],
  [/&#39;/gu, "'"],
  [/&apos;/gu, "'"],
  [/&amp;/gu, '&'],
]

/**
 * 영상 자리표시자를 반응형 16:9 iframe 으로 바꾼 표시용 HTML.
 *
 * src 와 속성은 전부 이 함수가 조립한다. 토큰은 `parseVideoToken` 이 provider·id
 * 형식을 다시 검사하므로 저장된 문자열이 마크업으로 새어 나갈 수 없다.
 * 알아볼 수 없는 토큰은 조용히 지운다(빈 검은 상자를 남기는 것보다 낫다).
 */
export function renderPostHtml(html: string): string {
  return html.replace(VIDEO_PLACEHOLDER_PATTERN, (_match, token: string) => {
    const embed = parseVideoToken(token)

    if (embed === null) {
      return ''
    }

    return (
      `<div class="video-embed">` +
      `<iframe src="${videoEmbedSrc(embed)}" title="${videoEmbedTitle(embed)}" loading="lazy"` +
      ` allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"` +
      ` referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>` +
      `</div>`
    )
  })
}

/** 본문 HTML → 사람이 읽는 평문. 목록 요약·길이 판정에 쓴다. */
export function postHtmlText(html: string): string {
  const withoutTags = html.replace(BLOCK_TAG_PATTERN, ' ').replace(ANY_TAG_PATTERN, '')
  const decoded = ENTITIES.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    withoutTags,
  )

  return decoded.replace(WHITESPACE_PATTERN, ' ').trim()
}
