import Image from 'next/image'

import { CreatorPanel } from '@/components/about/CreatorPanel'
import { HeroCharacters } from '@/components/about/HeroCharacters'
import { VideoHero } from '@/components/about/VideoHero'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { getSiteSettings } from '@/lib/data/site'
import { resolveAboutVideoUrl, resolveCreator } from '@/lib/data/site-view'
import { hasPublicAsset } from '@/lib/utils/asset'
import { extractYoutubeId, youtubeThumbnail } from '@/lib/utils/youtube'

import type { Metadata } from 'next'
import type { CSSProperties } from 'react'

/** 유튜브 URL 을 읽지 못했을 때 히어로가 쓰는 로컬 스틸. */
const FALLBACK_STILL = '/images/about/video-still.png'
const BAND_BG = '/images/about/band-bg.png'
const VINES = '/images/about/vines.png'

/** 시안 프레임 폭. 아래 좌표는 전부 이 폭 기준이다. */
const DESIGN_WIDTH = 1440

/**
 * 소개 페이지는 1440 한 장으로 그려진 전면 일러스트다.
 *
 * 좁은 화면에서 좌표를 그대로 쓰면 캐릭터 행·덩굴·풀숲이 화면 밖으로 밀려
 * 잘리므로, 모든 세로 좌표를 프레임 폭(`--about-w`)에 비례시켜 통째로 축소한다.
 * 1440 이상에서는 `--about-w` 가 1440 으로 고정되어 시안 좌표와 정확히 같다.
 */
const SCENE_STYLE = { '--about-w': `min(100vw, ${DESIGN_WIDTH}px)` } as CSSProperties

/** 시안 좌표(px)를 프레임 폭 비례 길이로 바꾼다. */
function scaled(px: number): string {
  return `calc(var(--about-w, ${DESIGN_WIDTH}px) * ${(px / DESIGN_WIDTH).toFixed(7)})`
}

/** 밴드 상단의 페이지 좌표. 아래 오프셋은 모두 이 값을 뺀 값이다. */
const BAND_TOP = 763

/** 돌 질감 밴드 배경(1440×1328)은 시안 기준 page y 940 에서 시작한다. */
const BAND_BG_TOP = scaled(940 - BAND_TOP)

/** 덩굴 레이어(Figma Group 224) page y 873.41, 1440×472. */
const VINES_TOP = scaled(873.41 - BAND_TOP)

/**
 * 풀숲 → 검은 잎사귀 캐노피로 넘어가는 구간의 그늘(page 763~1130).
 *
 * 시안에서는 풀숲 아랫단이 밴드의 검은 잎사귀 쪽으로 서서히 어두워지는데,
 * 받은 `hero-overlay.png` 에는 그 그늘 레이어가 빠져 있어 풀숲이 균일하게
 * 밝고 오버레이 하단(≈960)이 직선으로 잘려 보인다. 시안(about.png)과
 * 빌드의 같은 행 휘도비(1 − ref/build)를 알파로 옮긴 검정 그라데이션이다.
 * 정지점은 레이어 높이(367) 대비 % 라 축소돼도 같은 자리에 놓인다.
 * TODO(asset): 그늘이 포함된 오버레이 재추출본이 오면 이 레이어는 지운다.
 */
const HERO_SHADE_HEIGHT_PX = 367
const HERO_SHADE_STOPS: readonly [number, number][] = [
  [0, 0],
  [0.16, 17],
  [0.24, 37],
  [0.31, 57],
  [0.37, 77],
  [0.45, 97],
  [0.48, 117],
  [0.5, 137],
  [0.52, 187],
  [0.53, 212],
  [0.43, 237],
  [0.28, 262],
  [0.07, 287],
  [0.04, 312],
  [0.01, 337],
  [0, 367],
]
const HERO_SHADE_GRADIENT = `linear-gradient(180deg,${HERO_SHADE_STOPS.map(
  ([alpha, offset]) =>
    `rgba(0,0,0,${alpha}) ${((offset / HERO_SHADE_HEIGHT_PX) * 100).toFixed(4)}%`,
).join(',')})`

export const metadata: Metadata = {
  title: '소개',
  description:
    '메이플스토리의 역사를 함께해 온 2세대 최초 만렙 크리에이터가 만든 글자월드를 소개합니다.',
}

export default async function AboutPage(_props: PageProps<'/about'>) {
  const settings = await getSiteSettings()
  const creator = resolveCreator(settings)
  /* 히어로 영상은 푸터 `/sns/youtube` 와 같은 칸(`site_settings.youtube_url`)을
     읽는다. 채널 주소처럼 영상 ID 를 못 뽑는 값이면 null 이 되어 중립 포스터로
     떨어진다 — 무관한 영상을 자동으로 트는 것보다 안전하다. */
  const videoId = extractYoutubeId(resolveAboutVideoUrl(settings))
  const localStill = hasPublicAsset(FALLBACK_STILL) ? FALLBACK_STILL : null
  const thumbnail = videoId === null ? localStill : youtubeThumbnail(videoId)

  return (
    <>
      <div style={SCENE_STYLE} className="relative isolate overflow-x-clip bg-[#bfb9ff]">
        <VideoHero
          videoId={videoId}
          thumbnail={thumbnail}
          isDimmed={videoId !== null}
          title={`${creator.name} 크리에이터 소개 영상`}
        />

        {/* 보라→시안 돌 질감 밴드. */}
        <div className="relative bg-[linear-gradient(180deg,#bfb9ff_0%,#bfb9ff_50%,#76eaff_100%)]">
          {/* 밴드 배경은 늘리지 않고 시안 좌표 그대로 얹는다. 상단 ~200px 의
              검은 잎사귀 실루엣이 page 940~1140 에 놓여야 풀숲과 이어진다.
              (히어로 아래 763 부터 깔면 잎사귀가 풀숲 뒤로 숨어 이음매가 뜬다.)
              TODO(asset): 밴드 배경이 없으면 CSS 그라데이션만 남는다. */}
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            {hasPublicAsset(BAND_BG) ? (
              <Image
                src={BAND_BG}
                alt=""
                width={1440}
                height={1328}
                style={{ top: BAND_BG_TOP }}
                /* 1440 이하에서는 프레임과 같은 폭, 그 이상에서는 화면을 채운다
                   (좌우에 밋밋한 그라데이션 띠가 남지 않게). */
                className="absolute left-0 h-auto w-full max-w-none"
              />
            ) : null}
          </div>

          {/* 늘어진 덩굴 숲(page y 873.41, 1440×472). 히어로 오버레이의 풀숲
              아랫단과 보라 밴드가 만나는 자리를 덮어 이음매를 지운다.
              밴드 배경 위 · 양피지 패널 아래에 온다(DOM 순서 = 페인트 순서). */}
          {hasPublicAsset(VINES) ? (
            <div
              aria-hidden
              style={{ top: VINES_TOP }}
              className="pointer-events-none absolute left-1/2 hidden w-[var(--about-w)] -translate-x-1/2 lg:block"
            >
              <Image
                src={VINES}
                alt=""
                width={1440}
                height={472}
                className="h-auto w-full max-w-none"
              />
            </div>
          ) : null}

          {/* 시안: 양피지 패널 page x 59, w 1341 · 패널 아래 39px 뒤 푸터. */}
          <div className="relative mx-auto w-full max-w-[1440px] px-4 pt-20 pb-16 lg:pt-[calc(var(--about-w)*0.2534722)] lg:pr-[calc(var(--about-w)*0.0277778)] lg:pb-[calc(var(--about-w)*0.0270833)] lg:pl-[calc(var(--about-w)*0.0409722)]">
            <CreatorPanel creator={creator} />
          </div>
        </div>

        {/* 나무 단상·풀숲(정지 PNG) + 캐릭터 7종(GIF). 히어로 위에서 시작해
            밴드 위쪽까지 이어진다. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-0 left-1/2 hidden w-[var(--about-w)] -translate-x-1/2 lg:block"
        >
          <HeroCharacters />
        </div>

        <div
          aria-hidden
          style={{
            top: scaled(BAND_TOP),
            height: scaled(HERO_SHADE_HEIGHT_PX),
            backgroundImage: HERO_SHADE_GRADIENT,
          }}
          className="pointer-events-none absolute inset-x-0 hidden lg:block"
        />
      </div>

      <SiteFooter variant="about" />
    </>
  )
}
