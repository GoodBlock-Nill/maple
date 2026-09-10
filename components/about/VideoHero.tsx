'use client'

import Image from 'next/image'
import { useState } from 'react'

import { HeroMediaFrame, MEDIA_BOX_SIZES } from '@/components/about/HeroMediaFrame'
import { youtubeEmbedUrl } from '@/lib/utils/youtube'

type VideoHeroProps = {
  /** 재생할 유튜브 영상 id. 못 뽑은 값이면 페이지가 히어로를 아예 그리지 않는다. */
  videoId: string
  /** 상자 안 포스터 — 유튜브 썸네일 또는 배너 이미지. */
  thumbnail: string
  title: string
  /**
   * 썸네일이 Storage 공개 URL 등 next.config remotePatterns 밖의 주소일 때 true.
   * 최적화를 거치면 런타임에서 던지므로 원본을 그대로 쓴다.
   */
  isExternalThumbnail?: boolean
}

/** 시안의 유튜브 재생 버튼(141×100). 상자 폭에 맞춰 세 단계로 줄인다. */
const PLAY_MARK_SRC = '/images/about/youtube-play.png'
const PLAY_MARK_WIDTH = 141
const PLAY_MARK_HEIGHT = 100
const PLAY_MARK_CLASS = 'block h-auto w-[84px] lg:w-[100px] xl:w-[141px]'

function PlayMark() {
  return (
    <Image
      src={PLAY_MARK_SRC}
      alt=""
      width={PLAY_MARK_WIDTH}
      height={PLAY_MARK_HEIGHT}
      priority
      aria-hidden
      className={PLAY_MARK_CLASS}
    />
  )
}

/**
 * 소개 페이지 영상 히어로.
 *
 * 배경은 HeroMediaFrame 이 시안 히어로 배경으로 채우고, 영상 상자 안에 썸네일 +
 * 재생 버튼을 그린다. 클릭 시 상자 안에서 iframe 으로 교체한다
 * (lite-youtube 방식 — 초기 로드에 유튜브 스크립트를 싣지 않는다).
 *
 * 영상도 이미지도 없을 때 쓰는 중립 포스터 분기는 여기 없다 — 그 경우 페이지가
 * 이 컴포넌트를 아예 그리지 않고 `HeroMediaSpacer` 로 자리만 남긴다
 * (오너 요청 2026-09-10).
 */
export function VideoHero({
  videoId,
  thumbnail,
  title,
  isExternalThumbnail = false,
}: VideoHeroProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  return (
    <HeroMediaFrame>
      {isPlaying ? (
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <>
          <Image
            src={thumbnail}
            alt=""
            fill
            priority
            sizes={MEDIA_BOX_SIZES}
            unoptimized={isExternalThumbnail}
            className="object-cover object-center"
          />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <button
              type="button"
              onClick={() => setIsPlaying(true)}
              aria-label={`${title} 재생`}
              className="focus-visible:outline-focus rounded-[26px] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4"
            >
              <PlayMark />
            </button>
          </div>
        </>
      )}
    </HeroMediaFrame>
  )
}
