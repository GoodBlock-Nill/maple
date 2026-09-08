/**
 * 상대 경로 → 절대 URL.
 *
 * Open Graph · Twitter 카드 이미지는 크롤러가 사이트 밖에서 받아 가므로
 * 상대 경로를 쓸 수 없다. 기준 도메인은 `NEXT_PUBLIC_SITE_URL` 하나로 두고,
 * 값이 비면 로컬 개발 주소로 떨어뜨려 미리보기가 깨지지 않게 한다.
 *
 * `process.env.NEXT_PUBLIC_SITE_URL` 은 Next 가 정적 치환하므로 반드시
 * 리터럴로 읽는다(동적 접근은 번들에서 undefined 가 된다).
 */

const FALLBACK_ORIGIN = 'http://localhost:3000'

export function siteOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  const trimmed = raw.trim()

  if (trimmed === '') {
    return FALLBACK_ORIGIN
  }

  // 끝의 `/` 를 지워 `${origin}${path}` 조합에서 슬래시가 겹치지 않게 한다.
  return trimmed.replace(/\/+$/, '')
}

export function absoluteUrl(path: string): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path
  }

  return `${siteOrigin()}${path.startsWith('/') ? path : `/${path}`}`
}
