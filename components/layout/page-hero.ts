import type { FooterVariant } from '@/components/layout/footer-variants'

export type PageVariant = Extract<
  FooterVariant,
  'news' | 'community' | 'guide' | 'ranking' | 'support'
>

export type HeroMascot = {
  src: string
  /** 렌더 크기(1440 기준). 원본 GIF/PNG 는 저해상도라 업스케일된다. */
  width: number
  height: number
  /** 페이지 최상단·1440 좌표계 기준 절대 좌표. */
  left: number
  top: number
  /** 애니메이션 GIF 는 최적화를 건너뛰어야 움직임이 유지된다. */
  animated: boolean
}

/**
 * 1440 좌표를 좌·우 중 가까운 쪽 기준 오프셋으로 바꾼다.
 *
 * 장식 레이어는 1440 폭을 넘지 않고(`max-w-[1440px]`) 뷰포트가 좁아지면
 * 함께 줄어든다. 이때 1440 기준 `left` 를 그대로 쓰면 오른쪽 장식이 화면
 * 밖으로 밀려 잘린다. 오른쪽에 가까운 장식은 `right` 로 붙여 어떤 폭에서도
 * 잘리지 않게 한다(1440 에서는 결과가 동일하다).
 */
export function heroMascotOffset(mascot: HeroMascot): { left?: number; right?: number } {
  const right = HERO_LAYER_WIDTH - mascot.left - mascot.width

  return right < mascot.left ? { right } : { left: mascot.left }
}

/** 장식 좌표계 폭. */
const HERO_LAYER_WIDTH = 1440

export type HeroBand = {
  /** 헤더 뒤까지 올라오는 상단 배경 밴드. */
  src: string
  height: number
  /**
   * 배경이 투명 대신 흰 사각형으로 구워진 자산(가이드 단풍)은 곱연산으로
   * 겹쳐야 흰 부분이 페이지 바탕(#fafafa)에 녹는다.
   */
  blend?: boolean
  /** 자산이 아직 없을 때 대신 깔리는 CSS 배경. */
  fallback?: string
}

export type PageHeroConfig = {
  band: HeroBand
  /** 제목 블록 상단 오프셋(xl 이상, 페이지 최상단 기준). */
  contentTop: number
  mascots: readonly HeroMascot[]
}

export const PAGE_HERO: Record<PageVariant, PageHeroConfig> = {
  news: {
    band: { src: '/images/news/top-bg.png', height: 560 },
    contentTop: 334,
    mascots: [
      {
        src: '/images/news/mascot-top.gif',
        width: 268,
        height: 195,
        left: 931,
        top: 283,
        animated: true,
      },
    ],
  },
  community: {
    band: { src: '/images/community/top-bg.png', height: 413 },
    contentTop: 334,
    mascots: [
      {
        src: '/images/community/ship.png',
        width: 189,
        height: 184,
        left: 464,
        top: 27,
        animated: false,
      },
      {
        src: '/images/community/starfish-big.png',
        width: 158,
        height: 69,
        left: 302,
        top: 256,
        animated: false,
      },
      {
        src: '/images/community/starfish-small.png',
        width: 92,
        height: 40,
        left: 281,
        top: 311,
        animated: false,
      },
      {
        src: '/images/community/axolotl.gif',
        width: 291,
        height: 234,
        left: 1044,
        top: 307,
        animated: true,
      },
    ],
  },
  guide: {
    /* `top-bg.png` 은 잎 뒤에 흰 사각형이 구워져 있어 곱연산 보정이 필요했다.
       `top-bg-clean.png` 은 투명 배경이라 그대로 얹는다. */
    band: { src: '/images/guide/top-bg-clean.png', height: 505 },
    contentTop: 228,
    mascots: [
      {
        src: '/images/guide/fallen-leaves.png',
        width: 416,
        height: 149,
        left: 351,
        top: 122,
        animated: false,
      },
      {
        src: '/images/guide/mascot-top.gif',
        width: 169.71,
        height: 100.17,
        left: 1085.11,
        top: 330.45,
        animated: true,
      },
    ],
  },
  ranking: {
    band: { src: '/images/ranking/top-bg.png', height: 296 },
    contentTop: 334,
    mascots: [
      {
        src: '/images/ranking/deco-left.png',
        width: 108,
        height: 104,
        left: 0,
        top: 244,
        animated: false,
      },
      {
        src: '/images/ranking/mascot-panda.gif',
        width: 214.38,
        height: 177.1,
        left: 1059.31,
        top: 349.4,
        animated: true,
      },
      {
        src: '/images/ranking/deco-right.png',
        width: 160,
        height: 256,
        left: 1280,
        top: 224,
        animated: false,
      },
    ],
  },
  support: {
    band: {
      src: '/images/support/top-bg.png',
      height: 282,
      // TODO(asset): top-bg 가 없을 때도 눈 덮인 숲의 밝기를 흉내 낸다.
      fallback: 'linear-gradient(180deg, #ffffff 0%, #f2f6fa 55%, #fafafa 100%)',
    },
    contentTop: 334,
    mascots: [
      {
        src: '/images/support/deco-484.png',
        width: 60,
        height: 84,
        left: 161,
        top: 268,
        animated: false,
      },
      {
        src: '/images/support/deco-508.png',
        width: 162,
        height: 77,
        left: 273,
        top: 298,
        animated: false,
      },
      {
        src: '/images/support/mascot-top.gif',
        width: 271.19,
        height: 198.07,
        left: 979.87,
        top: 264.93,
        animated: true,
      },
      {
        src: '/images/support/deco-485.png',
        width: 60,
        height: 64,
        left: 1261,
        top: 275,
        animated: false,
      },
      {
        src: '/images/support/deco-479.png',
        width: 124,
        height: 60,
        left: 1271,
        top: 287,
        animated: false,
      },
    ],
  },
}
