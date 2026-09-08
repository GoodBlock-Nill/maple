import Image from 'next/image'

import { CreatorPanel } from '@/components/about/CreatorPanel'
import { VideoHero } from '@/components/about/VideoHero'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { CREATOR_VIDEO_TITLE, CREATOR_YOUTUBE_URL } from '@/lib/mock/site'
import { hasPublicAsset } from '@/lib/utils/asset'
import { extractYoutubeId, youtubeThumbnail } from '@/lib/utils/youtube'

import type { Metadata } from 'next'

/** 유튜브 URL 을 읽지 못했을 때 히어로가 쓰는 로컬 스틸. TODO(asset) */
const FALLBACK_STILL = '/images/about/video-still.png'
const BAND_BG = '/images/about/band-bg.png'
const HERO_OVERLAY = '/images/about/hero-overlay.png'

export const metadata: Metadata = {
  title: '소개',
  description:
    '메이플스토리의 역사를 함께해 온 2세대 최초 만렙 크리에이터가 만든 글자월드를 소개합니다.',
}

export default function AboutPage(_props: PageProps<'/about'>) {
  const videoId = extractYoutubeId(CREATOR_YOUTUBE_URL)
  const localStill = hasPublicAsset(FALLBACK_STILL) ? FALLBACK_STILL : null
  const thumbnail = videoId === null ? localStill : youtubeThumbnail(videoId)

  return (
    <>
      <div className="relative isolate overflow-x-clip bg-[#bfb9ff]">
        <VideoHero videoId={videoId} thumbnail={thumbnail} title={CREATOR_VIDEO_TITLE} />

        {/* 보라→시안 돌 질감 밴드. 시안에서는 히어로 아래 177px 지점부터
            시작하지만, 그 구간은 나무 단상 오버레이가 덮으므로 바로 잇는다. */}
        <div className="relative bg-[linear-gradient(180deg,#bfb9ff_0%,#bfb9ff_50%,#76eaff_100%)]">
          {/* TODO(asset): 밴드 배경이 없으면 CSS 그라데이션만 남는다. */}
          {hasPublicAsset(BAND_BG) ? (
            <Image
              src={BAND_BG}
              alt=""
              fill
              sizes="100vw"
              aria-hidden
              className="object-cover object-top"
            />
          ) : null}
          {/* 시안: 양피지 패널 page x 59, w 1341 · 패널 아래 39px 뒤 푸터. */}
          <div className="relative mx-auto w-full max-w-[1440px] px-4 pt-20 pb-16 lg:pt-[365px] lg:pr-[40px] lg:pb-[39px] lg:pl-[59px]">
            <CreatorPanel />
          </div>
        </div>

        {/* 캐릭터 행 + 나무 단상 + 풀숲 합성 오버레이. 히어로 위에서 시작해
            밴드 위쪽까지 이어진다. TODO(asset) */}
        {hasPublicAsset(HERO_OVERLAY) ? (
          <div
            aria-hidden
            className="pointer-events-none absolute top-0 left-1/2 hidden w-[1440px] -translate-x-1/2 lg:block"
          >
            <Image src={HERO_OVERLAY} alt="" width={1440} height={1017} className="max-w-none" />
          </div>
        ) : null}
      </div>

      <SiteFooter variant="about" />
    </>
  )
}
