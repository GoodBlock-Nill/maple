import Image from 'next/image'

import { CreatorPanel } from '@/components/about/CreatorPanel'
import { resolveAboutHeroMedia } from '@/components/about/hero-media'
import { HeroCharacters } from '@/components/about/HeroCharacters'
import { HeroMediaFrame } from '@/components/about/HeroMediaFrame'
import { ImageHero } from '@/components/about/ImageHero'
import { VideoHero } from '@/components/about/VideoHero'
import { SiteFooter } from '@/components/layout/SiteFooter'
import { getActiveHeroBanner } from '@/lib/data/hero-banner'
import { getSiteSettings } from '@/lib/data/site'
import { resolveAboutVideoUrl, resolveCreator } from '@/lib/data/site-view'
import { hasPublicAsset } from '@/lib/utils/asset'

import type { AboutHeroMedia } from '@/components/about/hero-media'
import type { Metadata } from 'next'
import type { CSSProperties } from 'react'

const BAND_BG = '/images/about/band-bg.png'
const VINES = '/images/about/vines.png'

/** 시안 프레임 폭. 아래 좌표는 전부 이 폭 기준이다. */
const DESIGN_WIDTH = 1440

/**
 * 소개 페이지는 1440 한 장으로 그려진 전면 일러스트다. 씬은 폭 기준을 둘 쓴다.
 *
 * - `--hero-w`: **뷰포트 폭 전체**. 히어로 배경·캐릭터·영상 상자·덩굴·밴드 배경처럼
 *   화면을 가로로 꽉 채우는 일러스트 레이어가 따른다. 1440 아래에서는 좌표를
 *   그대로 쓰면 캐릭터 행·덩굴·풀숲이 화면 밖으로 밀려 잘리므로 통째로 줄고,
 *   1440 위에서는 같은 비율로 커진다 — 예전처럼 1440 에서 멈추면 넓은 화면에서
 *   일러스트만 가운데 작게 남고 좌우에 빈 띠가 생긴다(오너 요청 2026-09-10).
 * - `--about-w`: 시안 폭(1440)에서 멈추는 본문 기준. 양피지 패널처럼 글을 담아
 *   무한정 넓어지면 안 되는 블록이 따른다.
 *
 * `100cqw` 는 씬 자신의 콘텐츠 폭이라 세로 스크롤바를 뺀 값이다 — `100vw` 로 잡으면
 * 스크롤바 폭만큼 넘쳐 가로 스크롤이 생긴다(씬 자신을 컨테이너로 선언해 둔다).
 */
const SCENE_STYLE = {
  containerType: 'inline-size',
  '--hero-w': '100cqw',
  '--about-w': `min(100cqw, ${DESIGN_WIDTH}px)`,
} as CSSProperties

/** 시안 좌표(px)를 히어로(뷰포트) 폭 비례 길이로 바꾼다. */
function scaled(px: number): string {
  return `calc(var(--hero-w, ${DESIGN_WIDTH}px) * ${(px / DESIGN_WIDTH).toFixed(7)})`
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

/**
 * 상단 영역(시안 1440×763)을 그린다. 무엇을 그릴지는 `resolveAboutHeroMedia` 가 정한다.
 * 영상도 이미지도 없으면 시안의 히어로 배경만 남고 상자·재생 버튼은 그리지 않는다.
 */
function renderTopMedia(media: AboutHeroMedia | null) {
  if (media === null) {
    return <HeroMediaFrame />
  }

  if (media.kind === 'image') {
    return <ImageHero src={media.src} alt={media.alt} href={media.href} />
  }

  return (
    <VideoHero
      videoId={media.videoId}
      thumbnail={media.thumbnail}
      title={media.title}
      isExternalThumbnail={media.isExternalThumbnail}
    />
  )
}

export default async function AboutPage(_props: PageProps<'/about'>) {
  const [settings, banner] = await Promise.all([getSiteSettings(), getActiveHeroBanner()])
  const creator = resolveCreator(settings)
  const media = resolveAboutHeroMedia(
    banner,
    resolveAboutVideoUrl(settings),
    `${creator.name} 크리에이터 소개 영상`,
  )

  return (
    <>
      <div style={SCENE_STYLE} className="relative isolate overflow-x-clip bg-[#bfb9ff]">
        {renderTopMedia(media)}

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
                /* 원본 2880 (2x). sizes 가 없으면 뷰포트가 아무리 넓어도 1x 후보
                   (1920)만 골라 넓은 화면에서 흐려진다. */
                sizes="100vw"
                style={{ top: BAND_BG_TOP }}
                /* 어느 폭에서도 화면을 가로로 채운다(좌우에 밋밋한 그라데이션 띠가
                   남지 않게). 높이는 폭에 따라와 히어로 풀숲과 이음매가 유지된다. */
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
              className="pointer-events-none absolute inset-x-0 hidden lg:block"
            >
              <Image
                src={VINES}
                alt=""
                width={1440}
                height={472}
                /* TODO(asset): 원본이 1440 1x 라 1920 이상에서는 확대된다. 2x 재수출 필요. */
                sizes="100vw"
                className="h-auto w-full max-w-none"
              />
            </div>
          ) : null}

          {/* 시안: 양피지 패널 page x 59, w 1341 · 패널 아래 39px 뒤 푸터.
              위 여백만 `--hero-w` 를 따른다 — 위에 깔린 덩굴·검은 잎사귀가 뷰포트
              폭에 비례해 내려오므로, 1440 에 고정하면 넓은 화면에서 패널이 그 위로 올라탄다. */}
          <div className="relative mx-auto w-full max-w-[1440px] px-4 pt-20 pb-16 lg:pt-[calc(var(--hero-w)*0.2534722)] lg:pr-[calc(var(--about-w)*0.0277778)] lg:pb-[calc(var(--about-w)*0.0270833)] lg:pl-[calc(var(--about-w)*0.0409722)]">
            <CreatorPanel creator={creator} />
          </div>
        </div>

        {/* 나무 단상·풀숲(정지 PNG) + 캐릭터 7종(GIF). 히어로 위에서 시작해
            밴드 위쪽까지 이어진다. */}
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 hidden lg:block">
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
