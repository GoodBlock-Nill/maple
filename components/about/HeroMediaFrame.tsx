import type { CSSProperties, ReactNode } from 'react'

/**
 * 소개 페이지 상단(1440×763) 미디어 프레임.
 *
 * 배경(backdrop)은 시안처럼 영역 전체를 채우고, 실제 영상·이미지는 그 위의
 * **상자 하나**에 들어간다(오너 요청 2026-09-09: 영상 가로는 헤더 메뉴바 폭이
 * 최대, 헤더바와 캐릭터를 가리지 않게).
 *
 * 상자 위치(lg 이상, 시안 1440 실측):
 *   - 위: 헤더 바닥(92) + 16 = 108px, 단 프레임이 넓어지면 시안 비례(112/1440)로 내려간다.
 *   - 아래: 캐릭터 행 윗변(502/1440 · 오른쪽 버섯은 x≥1166 라 상자와 겹치지 않음) − 20px.
 *   - 가로: 위 높이에서 16:9 로 나오는 폭, 헤더 바(804px)를 넘지 않는다.
 *   1440 → 658×370, 1280 → 565×318, 1024 → 407×229.
 *
 * lg 미만에서는 캐릭터 오버레이가 없고 헤더가 위를 덮으므로, 헤더 아래(112px)부터
 * 좌우 16px 여백의 16:9 상자를 흐름으로 놓고 프레임 높이는 그에 맞춘다.
 */
const HEADER_BOTTOM_PX = 92
const HEADER_GAP_PX = 16
const CHARACTER_GAP_PX = 20
const HEADER_BAR_WIDTH_PX = 804
/** 시안 좌표 비율(1440 기준): 상자 윗변 112, 캐릭터 행 윗변 502. */
const BOX_TOP_RATIO = 112 / 1440
const CHARACTER_TOP_RATIO = 502 / 1440

const BOX_VARS = {
  '--box-top': `max(${HEADER_BOTTOM_PX + HEADER_GAP_PX}px, calc(var(--about-w, 1440px) * ${BOX_TOP_RATIO.toFixed(6)}))`,
  '--box-h-raw': `calc(var(--about-w, 1440px) * ${CHARACTER_TOP_RATIO.toFixed(6)} - ${CHARACTER_GAP_PX}px - var(--box-top))`,
  '--box-h': `min(var(--box-h-raw), ${((HEADER_BAR_WIDTH_PX * 9) / 16).toFixed(2)}px)`,
  '--box-w': 'calc(var(--box-h) * 16 / 9)',
} as CSSProperties

type HeroMediaFrameProps = {
  /** 영역 전체를 채우는 배경(딤 썸네일 등). aria-hidden 으로 감싼다. */
  backdrop: ReactNode
  /** 상자 안에 들어가는 영상·이미지. */
  children: ReactNode
}

export function HeroMediaFrame({ backdrop, children }: HeroMediaFrameProps) {
  return (
    <div className="relative w-full overflow-hidden bg-[linear-gradient(180deg,#2b2b3d_0%,#0e0e14_100%)] pt-[112px] pb-4 lg:h-[calc(var(--about-w,1440px)*0.5298611)] lg:p-0">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {backdrop}
      </div>

      <div
        style={BOX_VARS}
        className="relative mx-4 aspect-video overflow-hidden rounded-[20px] bg-black shadow-[0_18px_48px_rgb(0_0_0/0.45)] lg:absolute lg:top-[var(--box-top)] lg:left-1/2 lg:mx-0 lg:aspect-auto lg:h-[var(--box-h)] lg:w-[var(--box-w)] lg:-translate-x-1/2"
      >
        {children}
      </div>
    </div>
  )
}
