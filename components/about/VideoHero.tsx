'use client'

import Image from 'next/image'
import { useState } from 'react'

import { youtubeEmbedUrl } from '@/lib/utils/youtube'

type VideoHeroProps = {
  /** null 이면 재생 버튼을 장식용 마크로 낮추고 클릭을 받지 않는다. */
  videoId: string | null
  /** 유튜브 썸네일 또는 로컬 스틸. null 이면 중립 포스터로 폴백한다. */
  thumbnail: string | null
  /**
   * 포스터 위에 검정 50% 딤을 덧씌울지 여부.
   * 로컬 스틸(`about/video-still.png`)은 시안 그대로 딤이 이미 구워져 있어
   * 한 번 더 얹으면 두 배로 어두워진다.
   */
  isDimmed: boolean
  title: string
  /**
   * 썸네일이 Storage 공개 URL 등 next.config remotePatterns 밖의 주소일 때 true.
   * 최적화를 거치면 런타임에서 던지므로 원본을 그대로 쓴다.
   */
  isExternalThumbnail?: boolean
}

/** 시안의 유튜브 재생 버튼(141×100). */
const PLAY_MARK_SRC = '/images/about/youtube-play.png'
const PLAY_MARK_WIDTH = 141
const PLAY_MARK_HEIGHT = 100

const PLAY_MARK_CLASS = 'block h-auto w-[100px] lg:w-[141px]'

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
 * 소개 페이지 영상 히어로(데스크톱 763px · 모바일 16:9).
 * 처음에는 썸네일 + 재생 버튼만 그리고, 클릭 시 iframe 으로 교체한다
 * (lite-youtube 방식 — 초기 로드에 유튜브 스크립트를 싣지 않는다).
 */
export function VideoHero({
  videoId,
  thumbnail,
  isDimmed,
  title,
  isExternalThumbnail = false,
}: VideoHeroProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  if (isPlaying && videoId !== null) {
    return (
      <div className="relative aspect-video w-full bg-black lg:aspect-auto lg:h-[calc(var(--about-w,1440px)*0.5298611)]">
        <iframe
          src={youtubeEmbedUrl(videoId)}
          title={title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          className="absolute inset-0 size-full border-0"
        />
      </div>
    )
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden bg-[linear-gradient(180deg,#2b2b3d_0%,#0e0e14_100%)] lg:aspect-auto lg:h-[calc(var(--about-w,1440px)*0.5298611)]">
      {/* 영상 주소도 로컬 스틸도 없으면 중립 포스터(위 그라데이션)만 남는다. */}
      {thumbnail === null ? null : (
        <>
          <Image
            src={thumbnail}
            alt=""
            fill
            priority
            sizes="100vw"
            unoptimized={isExternalThumbnail}
            className="object-cover object-center"
          />
          {isDimmed ? <div aria-hidden className="absolute inset-0 bg-black/50" /> : null}
        </>
      )}

      {/* 시안 기준 버튼 중심 (720, 382) = 히어로 정중앙. */}
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
    </div>
  )
}
