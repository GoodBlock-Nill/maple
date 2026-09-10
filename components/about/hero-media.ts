import { extractYoutubeId, youtubeThumbnail } from '@/lib/utils/youtube'

import type { HeroBanner } from '@/types/domain'

/**
 * 소개 페이지 상단 영역에 무엇을 그릴지 고르는 순수 규칙.
 *
 * 1) 관리자 히어로 배너(사이트 설정)가 노출 중이면 그것이 우선한다 — 유튜브면
 *    영상, 이미지면 이미지.
 * 2) 배너가 없으면 `site_settings.youtube_url` 의 영상을 튼다.
 * 3) **둘 다 없으면 null** — 상자도 폴백 스틸도 그리지 않는다
 *    (오너 요청 2026-09-10: "영상 및 이미지가 없으면 폴백 이미지 없이 안 보이게").
 *    채널 주소처럼 영상 id 를 못 뽑는 값도 "영상 없음"으로 본다 — 무관한 영상을
 *    자동으로 트는 것도, 빈 검은 상자를 남기는 것도 시안에 없다.
 *
 * 렌더와 떼어 둔 이유는 이 분기가 관리자 입력 조합(배너 유형 · 빈 URL ·
 * 채널 URL)마다 갈려서 테스트로 고정해 둬야 하기 때문이다.
 */
export type AboutHeroMedia =
  | { kind: 'image'; src: string; alt: string; href: string | null }
  | {
      kind: 'youtube'
      videoId: string
      /** 상자 안 포스터. 배너 이미지가 있으면 그것, 없으면 유튜브 썸네일. */
      thumbnail: string
      title: string
      /** 썸네일이 next.config `remotePatterns` 밖의 주소라 최적화를 건너뛸 때 true. */
      isExternalThumbnail: boolean
    }

export function resolveAboutHeroMedia(
  banner: HeroBanner | null,
  defaultVideoUrl: string,
  defaultTitle: string,
): AboutHeroMedia | null {
  if (banner !== null && banner.mediaType === 'image' && banner.imageUrl !== null) {
    return { kind: 'image', src: banner.imageUrl, alt: banner.title, href: banner.linkUrl }
  }

  if (banner !== null && banner.mediaType === 'youtube' && banner.youtubeId !== null) {
    return {
      kind: 'youtube',
      videoId: banner.youtubeId,
      thumbnail: banner.imageUrl ?? youtubeThumbnail(banner.youtubeId),
      title: banner.title,
      isExternalThumbnail: banner.imageUrl !== null && !banner.imageUrl.startsWith('/'),
    }
  }

  const videoId = extractYoutubeId(defaultVideoUrl)

  if (videoId === null) {
    return null
  }

  return {
    kind: 'youtube',
    videoId,
    thumbnail: youtubeThumbnail(videoId),
    title: defaultTitle,
    isExternalThumbnail: false,
  }
}
