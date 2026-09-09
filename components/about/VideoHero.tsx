'use client'

import Image from 'next/image'
import { useState } from 'react'

import { HeroMediaFrame } from '@/components/about/HeroMediaFrame'
import { youtubeEmbedUrl } from '@/lib/utils/youtube'

type VideoHeroProps = {
  /** null 이면 재생 버튼을 장식용 마크로 낮추고 클릭을 받지 않는다. */
  videoId: string | null
  /** 유튜브 썸네일 또는 로컬 스틸. null 이면 중립 포스터로 폴백한다. */
  thumbnail: string | null
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
      {isPlaying && videoId !== null ? (
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <>
          {thumbnail === null ? null : (
            <Image
              src={thumbnail}
              alt=""
              fill
              priority
              sizes="(min-width: 1024px) 804px, 100vw"
              unoptimized={isExternalThumbnail}
              className="object-cover object-center"
            />
          )}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            {videoId === null ? (
              /* 재생할 영상이 없을 때는 시안의 버튼만 남기고 조작은 받지 않는다. */
              <PlayMark />
            ) : (
              <button
                type="button"
                onClick={() => setIsPlaying(true)}
                aria-label={`${title} 재생`}
                className="focus-visible:outline-focus rounded-[26px] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4"
              >
                <PlayMark />
              </button>
            )}
          </div>
        </>
      )}
    </HeroMediaFrame>
  )
}
