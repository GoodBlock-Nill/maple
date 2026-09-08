'use client'

import Image from 'next/image'
import { useState } from 'react'

import { youtubeEmbedUrl } from '@/lib/utils/youtube'

type VideoHeroProps = {
  /** null 이면 썸네일 대신 폴백 스틸을 쓰고 재생 버튼을 숨긴다. */
  videoId: string | null
  thumbnail: string
  title: string
}

/**
 * 소개 페이지 영상 히어로(데스크톱 763px · 모바일 16:9).
 * 처음에는 썸네일 + 딤 + 재생 버튼만 그리고, 클릭 시 iframe 으로 교체한다
 * (lite-youtube 방식 — 초기 로드에 유튜브 스크립트를 싣지 않는다).
 */
export function VideoHero({ videoId, thumbnail, title }: VideoHeroProps) {
  const [isPlaying, setIsPlaying] = useState(false)

  if (isPlaying && videoId !== null) {
    return (
      <div className="relative aspect-video w-full bg-black lg:aspect-auto lg:h-[763px]">
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
    <div className="relative aspect-video w-full overflow-hidden bg-[#1b1420] lg:aspect-auto lg:h-[763px]">
      <Image
        src={thumbnail}
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div aria-hidden className="absolute inset-0 bg-black/50" />

      {videoId === null ? null : (
        <button
          type="button"
          onClick={() => setIsPlaying(true)}
          aria-label={`${title} 재생`}
          className="focus-visible:outline-focus absolute top-1/2 left-1/2 flex h-[70px] w-[100px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[18px] bg-[#ff0000] transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-4 lg:h-[100px] lg:w-[141px] lg:rounded-[26px]"
        >
          {/* TODO(asset): about/youtube-play.svg 도착 전까지 CSS/SVG 로 그린 버튼. */}
          <svg viewBox="0 0 24 28" aria-hidden className="h-[38%] w-auto">
            <path d="M2 1.5 22 14 2 26.5Z" fill="#ffffff" />
          </svg>
        </button>
      )}
    </div>
  )
}
