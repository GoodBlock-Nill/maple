/**
 * 유튜브 URL → videoId 추출.
 * `watch?v=`, `youtu.be/`, `embed/`, `shorts/` 네 형태를 지원한다.
 * 형태를 알아볼 수 없으면 null 을 반환해 호출부가 폴백 이미지를 쓰게 한다.
 */
const ID_PATTERN = /^[\w-]{6,20}$/

export function extractYoutubeId(url: string): string | null {
  const patterns = [/[?&]v=([^&#]+)/, /youtu\.be\/([^?&#/]+)/, /\/(?:embed|shorts)\/([^?&#/]+)/]

  for (const pattern of patterns) {
    const id = pattern.exec(url)?.[1]

    if (id !== undefined && ID_PATTERN.test(id)) {
      return id
    }
  }

  return null
}

/** 최대 해상도 썸네일. next.config.ts 의 `i.ytimg.com` 패턴과 짝을 이룬다. */
export function youtubeThumbnail(id: string): string {
  return `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`
}

/** 클릭 시 교체되는 임베드 주소(자동 재생 + 관련 영상 제한). */
export function youtubeEmbedUrl(id: string): string {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
}
