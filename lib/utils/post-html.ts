import { parseVideoToken, videoEmbedSrc, videoEmbedTitle } from '@/lib/utils/video-embed'

/**
 * **정제를 마친** 본문 HTML 위에서만 도는 순수 헬퍼.
 *
 * 여기 있는 정규식은 임의의 HTML 이 아니라 `sanitizePostHtml()` 의 출력만 상대한다.
 * 정제기가 속성값의 `<`·`>`·`"` 를 이미 이스케이프하므로 `<[^>]*>` 같은 단순한
 * 패턴으로도 태그 경계를 정확히 집을 수 있다. 검증(`lib/validation/post.ts`)과
 * 에디터가 함께 쓰기 때문에 `sanitize-html` 을 여기로 끌어들이지 않는다 —
 * 끌어들이면 파서 전체가 클라이언트 번들에 실린다.
 */

/** 문단 경계는 공백으로 바꿔야 "제목본문" 처럼 붙어 읽히지 않는다. */
const BLOCK_TAG_PATTERN = /<\/?(?:p|div|h2|h3|ul|ol|li|blockquote|br)\b[^>]*>/giu
const ANY_TAG_PATTERN = /<[^>]*>/gu
const WHITESPACE_PATTERN = /\s+/gu

/** 정제기가 남기는 자리표시자. 속성 순서·따옴표까지 정제기 출력과 1:1 로 맞춘다. */
const VIDEO_PLACEHOLDER_PATTERN = /<div data-video="([^"]*)"><\/div>/gu

const IMAGE_TAG_PATTERN = /<img\b/giu

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

/** 본문 HTML → 사람이 읽는 평문. 목록 미리보기·메타 설명·길이 판정에 쓴다. */
export function postHtmlText(html: string): string {
  const withoutTags = html.replace(BLOCK_TAG_PATTERN, ' ').replace(ANY_TAG_PATTERN, '')
  const decoded = ENTITIES.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    withoutTags,
  )

  return decoded.replace(WHITESPACE_PATTERN, ' ').trim()
}

/** 이미지 + 영상 자리표시자 개수. 글자 없이 사진만 올린 글도 유효하게 보려면 필요하다. */
export function countPostHtmlMedia(html: string): number {
  const images = html.match(IMAGE_TAG_PATTERN)?.length ?? 0
  const videos = html.match(VIDEO_PLACEHOLDER_PATTERN)?.length ?? 0

  return images + videos
}

/** "글자 한 자 이상" 또는 "이미지·영상 하나 이상" 이면 내용이 있는 글이다. */
export function hasPostHtmlContent(html: string): boolean {
  return postHtmlText(html).length > 0 || countPostHtmlMedia(html) > 0
}

/**
 * 영상 자리표시자를 반응형 16:9 iframe 으로 바꾼 **표시용** HTML.
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
