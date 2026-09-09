/**
 * 유튜브 주소 → 영상 id.
 *
 * 운영자는 브라우저 주소창의 값을 그대로 붙여 넣는다. 그래서 `watch?v=` ·
 * `youtu.be` · `shorts` · `embed` · `live` 다섯 형태를 모두 받는다.
 *
 * 사용자 사이트에도 같은 역할의 함수가 있다(루트 `lib/utils/youtube.ts` ·
 * `extractYoutubeId`). 주소 형태를 맞춰 두되 **가져다 쓰지는 않는다** — 관리자
 * 앱은 별도 배포이고 두 앱의 `@/` 경로가 서로를 가리키지 않는다. 형태를 바꿀 일이
 * 생기면 두 파일을 함께 본다.
 *
 * 관리자 쪽이 더 좁다 — 저장 전에 거르는 자리라서 호스트를 화이트리스트로 묶고
 * id 를 11자로 고정한다(사용자 사이트는 이미 저장된 값을 읽어 주는 자리라 넓다).
 * `live` 주소는 여기에만 있다. 운영자가 생방송 다시보기 주소를 그대로 붙여 넣기
 * 때문이고, 저장되는 값은 어차피 id 로 환원되므로 읽는 쪽은 영향이 없다.
 */

/**
 * 유튜브 영상 id 는 11자다. 사용자 사이트는 옛 토큰까지 감안해 6~20자를
 * 허용하지만, 운영자가 직접 입력하는 관리자에서는 좁게 잡는다. 11자만 통과시키면
 * `watch?v=` 뒤에 붙은 재생목록 조각 같은 오입력이 저장 전에 걸린다.
 */
const YOUTUBE_ID_PATTERN = /^[\w-]{11}$/

/** 호스트를 좁히지 않으면 `https://evil.example/?v=…` 도 유튜브로 읽힌다. */
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

const HTTP_PROTOCOLS: ReadonlySet<string> = new Set(['http:', 'https:'])

/** `/shorts/<id>` · `/embed/<id>` · `/live/<id>` · `/v/<id>`. */
const SEGMENT_PATTERN = /^\/(?:shorts|embed|live|v)\/([^/?#]+)/

/** `youtu.be/<id>` 짧은 주소. 다른 호스트에는 쓰지 않는다. */
const SHORT_PATTERN = /^\/([^/?#]+)$/

function toHttpUrl(input: string): URL | null {
  try {
    const url = new URL(input.trim())

    return HTTP_PROTOCOLS.has(url.protocol) ? url : null
  } catch {
    return null
  }
}

/** 주소를 알아볼 수 없으면 null. 호출부는 그때 오류 문구를 보여 준다. */
export function parseYoutubeId(url: string): string | null {
  const parsed = toHttpUrl(url)

  if (parsed === null) {
    return null
  }

  const host = parsed.hostname.toLowerCase()

  if (!YOUTUBE_HOSTS.has(host)) {
    return null
  }

  const candidates: readonly (string | null | undefined)[] = [
    parsed.searchParams.get('v'),
    SEGMENT_PATTERN.exec(parsed.pathname)?.[1],
    host.endsWith('youtu.be') ? SHORT_PATTERN.exec(parsed.pathname)?.[1] : null,
  ]

  for (const candidate of candidates) {
    if (candidate !== null && candidate !== undefined && YOUTUBE_ID_PATTERN.test(candidate)) {
      return candidate
    }
  }

  return null
}

/**
 * 목록 썸네일. `hqdefault` 는 모든 영상에 반드시 존재한다 —
 * `maxresdefault` 는 고화질 원본이 없는 영상에서 404 가 되어 칸이 비어 버린다.
 */
export function youtubeThumbnailUrl(id: string): string {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}
