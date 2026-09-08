/**
 * 본문 영상 임베드의 단일 진실 — 사용자 사이트 `lib/utils/video-embed.ts` 의 사본.
 *
 * 저장 형식은 iframe 이 아니라 **자리표시자 토큰**(`youtube:<id>`)이다. iframe 을
 * 그대로 저장하면 허용 목록을 통과한 순간 src·allow·sandbox 를 전부 신뢰해야 하고,
 * 나중에 정책을 바꿔도 이미 저장된 글은 옛 속성을 들고 있다. 토큰만 남기면 렌더
 * 시점에 우리가 만든 마크업으로 항상 새로 조립할 수 있다.
 *
 * 관리자가 쓴 글을 사용자 사이트가 그대로 렌더하므로 **두 사본의 규칙이 같아야
 * 한다.** 한쪽만 바꾸면 관리자가 넣은 영상이 사용자 화면에서 사라진다.
 * 순수 함수만 두어 에디터(클라이언트)와 정제기(서버)가 함께 쓴다.
 */

export type VideoProvider = 'youtube' | 'vimeo'

export type VideoEmbed = {
  provider: VideoProvider
  id: string
}

/**
 * 호스트를 화이트리스트로 좁힌다. `[?&]v=` 같은 패턴만 보면
 * `https://evil.example/?v=abc` 도 유튜브로 인식되어 엉뚱한 임베드가 만들어진다.
 */
const YOUTUBE_HOSTS: ReadonlySet<string> = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
  'www.youtu.be',
])

const VIMEO_HOSTS: ReadonlySet<string> = new Set(['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'])

const HTTP_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:'])

/** 유튜브 id 는 영숫자·`-`·`_` 만 쓴다. 토큰 문자열에 그대로 들어가므로 폭을 좁게 잡는다. */
const YOUTUBE_ID_PATTERN = /^[\w-]{6,20}$/u

/** Vimeo id 는 순수 숫자다. */
const VIMEO_ID_PATTERN = /^\d{6,12}$/u

const ID_PATTERN: Record<VideoProvider, RegExp> = {
  youtube: YOUTUBE_ID_PATTERN,
  vimeo: VIMEO_ID_PATTERN,
}

const YOUTUBE_URL_PATTERNS = [
  /[?&]v=([^&#]+)/u,
  /youtu\.be\/([^?&#/]+)/u,
  /\/(?:embed|shorts)\/([^?&#/]+)/u,
]

/** http(s) 가 아닌 스킴(javascript:, data: …)은 여기서 전부 걸러진다. */
function toHttpUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim())

    return HTTP_PROTOCOLS.has(url.protocol) ? url : null
  } catch {
    return null
  }
}

function extractYoutubeId(href: string): string | null {
  for (const pattern of YOUTUBE_URL_PATTERNS) {
    const id = pattern.exec(href)?.[1]

    if (id !== undefined && YOUTUBE_ID_PATTERN.test(id)) {
      return id
    }
  }

  return null
}

/** `/video/123456789`, `/channels/staffpicks/123456789` 모두 마지막 숫자 세그먼트가 id 다. */
function extractVimeoId(pathname: string): string | null {
  const segments = pathname.split('/').filter((segment) => segment !== '')
  const last = segments[segments.length - 1]

  return last !== undefined && VIMEO_ID_PATTERN.test(last) ? last : null
}

/** 운영자가 붙여 넣은 주소 → 임베드 정보. 알아볼 수 없으면 null 이다. */
export function parseVideoUrl(input: string): VideoEmbed | null {
  const url = toHttpUrl(input)

  if (url === null) {
    return null
  }

  const host = url.hostname.toLowerCase()

  if (YOUTUBE_HOSTS.has(host)) {
    const id = extractYoutubeId(url.href)

    return id === null ? null : { provider: 'youtube', id }
  }

  if (VIMEO_HOSTS.has(host)) {
    const id = extractVimeoId(url.pathname)

    return id === null ? null : { provider: 'vimeo', id }
  }

  return null
}

/** 본문 HTML 에 저장되는 토큰. `data-video` 속성값이 된다. */
export function toVideoToken(embed: VideoEmbed): string {
  return `${embed.provider}:${embed.id}`
}

/**
 * 토큰 → 임베드 정보.
 *
 * 저장된 값이라도 다시 검증한다. DB 는 신뢰 경계 밖이고(직접 UPDATE·과거 버그),
 * 이 함수의 결과가 곧 iframe src 가 되기 때문이다.
 */
export function parseVideoToken(token: string): VideoEmbed | null {
  const separator = token.indexOf(':')

  if (separator < 0) {
    return null
  }

  const provider = token.slice(0, separator)
  const id = token.slice(separator + 1)

  if (provider !== 'youtube' && provider !== 'vimeo') {
    return null
  }

  return ID_PATTERN[provider].test(id) ? { provider, id } : null
}

/** 임베드 주소. 유튜브는 쿠키를 심지 않는 `youtube-nocookie.com` 을 쓴다. */
export function videoEmbedSrc({ provider, id }: VideoEmbed): string {
  return provider === 'youtube'
    ? `https://www.youtube-nocookie.com/embed/${id}`
    : `https://player.vimeo.com/video/${id}`
}

/** iframe 은 접근성 이름이 없으면 스크린 리더가 "프레임"으로만 읽는다. */
export function videoEmbedTitle({ provider }: VideoEmbed): string {
  return provider === 'youtube' ? 'YouTube 동영상' : 'Vimeo 동영상'
}
