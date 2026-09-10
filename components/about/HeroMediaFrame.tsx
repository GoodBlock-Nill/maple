import Image from 'next/image'

import type { CSSProperties, ReactNode } from 'react'

/**
 * 소개 페이지 상단(시안 1440×763) 미디어 프레임.
 *
 * 배경은 항상 **시안의 히어로 배경**(`about/video-still.png`, 50% 딤이 구워진
 * 1440×763 스틸)이고, 실제 영상·이미지는 그 위의 **상자 하나**에 들어간다
 * (오너 요청 2026-09-09: 영상 가로는 헤더 메뉴바 폭이 최대, 헤더바와 캐릭터를
 * 가리지 않게, 배경은 영상 썸네일이 아닌 기존 히어로 배경).
 *
 * 좌표는 전부 `--hero-w`(= 뷰포트 폭) 비례라 1440 위에서도 씬 전체가 같은
 * 비율로 커진다(오너 요청 2026-09-10). 상자 위치(lg 이상, 시안 1440 실측):
 *   - 위: 시안 비례(112/1440). 단 폭이 좁아 헤더와 겹칠 상황이면 헤더 바닥(92)+16 에서 멈춘다.
 *   - 아래: 캐릭터 행 윗변(502/1440 · 오른쪽 버섯은 x≥1166 라 상자와 겹치지 않음) − 20px.
 *   - 가로: 위 높이에서 16:9 로 나오는 폭.
 *   1024 → 407×229, 1280 → 566×318, 1440 → 658×370, 1920 → 889×500, 2560 → 1197×673.
 *   (2026-09-09 의 804px 상한은 1743 이상에서 상자만 안 커지게 만들어 폐기했다 —
 *    헤더 바는 고정폭이지만 상자는 캐릭터 행에 매여 있어 겹칠 일이 없다.)
 *
 * lg 미만에서는 캐릭터 오버레이가 없고 헤더가 위를 덮으므로, 헤더 아래(112px)부터
 * 좌우 16px 여백의 16:9 상자를 흐름으로 놓고 프레임 높이는 그에 맞춘다.
 *
 * 영상도 이미지도 없으면(`children` 없음) **배경만** 남는다 — 상자·재생 버튼·
 * 폴백 썸네일은 그리지 않는다(오너 요청 2026-09-10).
 */
const HEADER_BOTTOM_PX = 92
const HEADER_GAP_PX = 16
const CHARACTER_GAP_PX = 20
/** 시안 좌표 비율(1440 기준): 상자 윗변 112, 캐릭터 행 윗변 502. */
const BOX_TOP_RATIO = 112 / 1440
const CHARACTER_TOP_RATIO = 502 / 1440

/**
 * 프레임(가장 바깥 div) 클래스. 높이는 뷰포트 폭 × 763/1440(시안 비율)이다.
 *
 * - 미디어가 있을 때(lg 미만): 헤더 아래 112px 부터 16:9 상자를 흐름으로 놓고
 *   높이는 그 상자가 정한다. lg 이상에서만 시안 비율로 고정한다.
 * - 미디어가 없을 때: 상자가 없으니 어느 폭에서든 시안 비율 그대로 둔다 —
 *   그래야 시안의 히어로 배경이 잘리지 않고 한 판으로 보인다.
 *
 * Tailwind 스캐너는 파일에 **글자 그대로** 있는 클래스만 찾는다 — 비율을
 * 문자열로 조립하면 CSS 가 생성되지 않으므로 계산값을 그대로 박아 둔다.
 */
const FRAME_BASE_CLASS =
  'relative w-full overflow-hidden bg-[linear-gradient(180deg,#2b2b3d_0%,#0e0e14_100%)]'
const FRAME_WITH_BOX_CLASS = 'pt-[112px] pb-4 lg:h-[calc(var(--hero-w,1440px)*0.5298611)] lg:p-0'
const FRAME_WITHOUT_BOX_CLASS = 'h-[calc(var(--hero-w,1440px)*0.5298611)]'

const BOX_VARS = {
  '--box-top': `max(${HEADER_BOTTOM_PX + HEADER_GAP_PX}px, calc(var(--hero-w, 1440px) * ${BOX_TOP_RATIO.toFixed(6)}))`,
  '--box-h': `calc(var(--hero-w, 1440px) * ${CHARACTER_TOP_RATIO.toFixed(6)} - ${CHARACTER_GAP_PX}px - var(--box-top))`,
  '--box-w': 'calc(var(--box-h) * 16 / 9)',
} as CSSProperties

/**
 * 상자 안 영상·이미지가 고를 변형 폭. 상자 폭 = 뷰포트 폭 × 약 0.463~0.468
 * (16:9 · 캐릭터 행에 매인 높이에서 나온다).
 * 1440 이하는 예전 값(804px)을 그대로 둔다 — 같은 후보(828w)가 뽑혀 시안 폭에서
 * 픽셀이 달라지지 않는다. 그 위에서만 폭 비례로 큰 변형을 고른다.
 */
export const MEDIA_BOX_SIZES = '(min-width: 1441px) 47vw, (min-width: 1024px) 804px, 100vw'

/* 시안 히어로 배경(저장소 자산). VideoHero 가 클라이언트 컴포넌트라 이 파일도 클라이언트
   번들에 들어가므로 fs 를 쓰는 hasPublicAsset 은 여기서 부를 수 없다 — 항상 그린다.
   TODO(asset): 원본이 1440×763 1x 뿐이라 1920 에서 1.33배, 2560 에서 1.78배 확대된다
   (무대·밴드 배경은 2x 라 선명하다). 2880 재수출본이 오면 파일만 바꾸면 된다. */
const BACKDROP_SRC = '/images/about/video-still.png'

type HeroMediaFrameProps = {
  /**
   * 상자 안에 들어가는 영상·이미지.
   *
   * 없으면(관리자 배너도 `site_settings.youtube_url` 도 없을 때) **시안의 히어로
   * 배경만** 남기고 상자·재생 버튼·썸네일을 아예 그리지 않는다
   * (오너 요청 2026-09-10: "미디어 없음 = 시안의 원래 히어로 배경만 보인다").
   */
  children?: ReactNode
}

export function HeroMediaFrame({ children = null }: HeroMediaFrameProps) {
  return (
    <div
      className={`${FRAME_BASE_CLASS} ${children === null ? FRAME_WITHOUT_BOX_CLASS : FRAME_WITH_BOX_CLASS}`}
    >
      <Image
        src={BACKDROP_SRC}
        alt=""
        fill
        priority
        sizes="100vw"
        aria-hidden
        className="pointer-events-none object-cover object-center"
      />

      {children === null ? null : (
        <div
          style={BOX_VARS}
          className="relative mx-4 aspect-video overflow-hidden rounded-[20px] bg-black shadow-[0_18px_48px_rgb(0_0_0/0.45)] lg:absolute lg:top-[var(--box-top)] lg:left-1/2 lg:mx-0 lg:aspect-auto lg:h-[var(--box-h)] lg:w-[var(--box-w)] lg:-translate-x-1/2"
        >
          {children}
        </div>
      )}
    </div>
  )
}
