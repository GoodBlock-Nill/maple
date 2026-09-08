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
  /** 페이지 최상단 기준 절대 좌표. */
  left: number
  top: number
  /** 애니메이션 GIF 는 최적화를 건너뛰어야 움직임이 유지된다. */
  animated: boolean
}

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
    /* 단풍 배경은 잎 뒤에 흰 사각형이 구워져 있어 곱연산으로 얹는다. */
    band: { src: '/images/guide/top-bg.png', height: 420, blend: true },
    contentTop: 228,
    mascots: [
      {
        src: '/images/guide/mascot-top.png',
        width: 170,
        height: 101,
        left: 1085,
        top: 330,
        animated: false,
      },
    ],
  },
  ranking: {
    band: { src: '/images/ranking/top-bg.png', height: 296 },
    contentTop: 334,
    mascots: [
      // TODO(asset): deco-left / mascot-panda / deco-right 는 아직 내려받는 중이다.
      {
        src: '/images/ranking/deco-left.png',
        width: 108,
        height: 104,
        left: 0,
        top: 244,
        animated: false,
      },
      {
        src: '/images/ranking/mascot-panda.png',
        width: 214,
        height: 177,
        left: 1059,
        top: 349,
        animated: false,
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
        src: '/images/support/mascot-snowmen.png',
        width: 271,
        height: 198,
        left: 980,
        top: 265,
        animated: false,
      },
    ],
  },
}
