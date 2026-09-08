/**
 * 헤더 CTA·푸터 SNS 링크가 가리키는 외부 목적지를 계산한다.
 *
 * `site_settings` 값(월드 ID·디스코드·유튜브 URL)은 관리자 입력이라 비어 있거나
 * 공백일 수 있다. 값이 없으면 정식 URL이 채워지기 전까지 쓸 플레이스홀더로
 * 대체하고, 값이 있어도 `javascript:` 같은 위험한 스킴이면 목적지 리다이렉트가
 * 오픈 리다이렉트 통로가 되지 않도록 http(s) 만 허용한다.
 */

const PLAY_URL_BASE = 'https://maplestoryworlds.nexon.com/ko/play'

/** TODO(content): 실제 월드 ID가 오기 전까지의 플레이스홀더. */
export const PLAY_URL_FALLBACK = 'https://maplestoryworlds.nexon.com/ko'

/** TODO(content): 실제 디스코드 초대 링크가 오기 전까지의 플레이스홀더. */
export const DISCORD_URL_FALLBACK = 'https://discord.com/invite/5Vk9k5pPb'

/** `site_settings.youtube_url` 이 비어 있을 때 쓰는 공식 채널(세글자) URL. */
export const YOUTUBE_URL_FALLBACK = 'https://www.youtube.com/@%EC%84%B8%EA%B8%80%EC%9E%90'

/** TODO(content): 페이스북 URL은 DB(SiteSettings)에 컬럼이 없어 항상 이 값을 쓴다. */
export const FACEBOOK_URL_FALLBACK = 'https://www.facebook.com'

export type SnsName = 'youtube' | 'discord' | 'facebook'

const SNS_NAMES: readonly SnsName[] = ['youtube', 'discord', 'facebook']

export type SnsDestinationSettings = {
  discordUrl: string | null
  youtubeUrl: string | null
}

function isSnsName(value: string): value is SnsName {
  return SNS_NAMES.includes(value as SnsName)
}

/** `null`/빈 문자열/공백 문자열을 모두 "값 없음"으로 취급한다. */
function normalize(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null
  }

  const trimmed = value.trim()

  return trimmed.length === 0 ? null : trimmed
}

/**
 * http/https 목적지만 허용한다. 관리자 DB 값을 그대로 리다이렉트 목적지로
 * 쓰면 `javascript:` 등 위험한 스킴이 저장됐을 때 오픈 리다이렉트가 된다.
 */
export function isSafeExternalUrl(value: string): boolean {
  try {
    const url = new URL(value)

    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

/** `/play` → 메이플스토리 월드 플레이 페이지. */
export function resolvePlayDestination(worldId: string | null | undefined): string {
  const normalized = normalize(worldId)

  if (normalized === null) {
    return PLAY_URL_FALLBACK
  }

  const candidate = `${PLAY_URL_BASE}/${encodeURIComponent(normalized)}`

  return isSafeExternalUrl(candidate) ? candidate : PLAY_URL_FALLBACK
}

/** `/discord` → 디스코드 서버 초대 링크. `/sns/discord` 도 같은 목적지를 쓴다. */
export function resolveDiscordDestination(discordUrl: string | null | undefined): string {
  const normalized = normalize(discordUrl)

  if (normalized === null) {
    return DISCORD_URL_FALLBACK
  }

  return isSafeExternalUrl(normalized) ? normalized : DISCORD_URL_FALLBACK
}

/** `/sns/youtube` → 유튜브 채널 링크. */
export function resolveYoutubeDestination(youtubeUrl: string | null | undefined): string {
  const normalized = normalize(youtubeUrl)

  if (normalized === null) {
    return YOUTUBE_URL_FALLBACK
  }

  return isSafeExternalUrl(normalized) ? normalized : YOUTUBE_URL_FALLBACK
}

/**
 * `/sns/[name]` 목적지를 계산한다. 알 수 없는 `name` 이면 `null` 을 돌려주며,
 * 호출부는 이를 404 로 처리해야 한다.
 */
export function resolveSnsDestination(
  name: string,
  settings: SnsDestinationSettings,
): string | null {
  if (!isSnsName(name)) {
    return null
  }

  switch (name) {
    case 'youtube':
      return resolveYoutubeDestination(settings.youtubeUrl)
    case 'facebook':
      return FACEBOOK_URL_FALLBACK
    case 'discord':
      return resolveDiscordDestination(settings.discordUrl)
  }
}
