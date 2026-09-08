import type { CSSProperties } from 'react'

/** 히어로 시안 프레임. 아래 좌표·크기는 모두 이 프레임 기준 px 다. */
export const HERO_FRAME = { width: 1440, height: 760 } as const

export type HeroCharacter = {
  src: string
  /** 프레임 좌상단 기준 좌표. */
  x: number
  y: number
  /** 시안에서의 표시 크기. 원본 GIF 와 비율이 같아 cover 로 잘리지 않는다. */
  width: number
  height: number
  /** 시안에서 좌우로 뒤집힌 캐릭터. */
  mirrored?: boolean
}

/**
 * 히어로 위에 얹히는 애니메이션 GIF 4종.
 *
 * 배경(`hero-bg-v2.jpg`)은 이 캐릭터들을 숨긴 채 다시 export 한 것이라 정지
 * 프레임이 구워져 있지 않다. 좌표는 구버전 배경(캐릭터 포함)과 겹쳐 1px 이내로
 * 일치함을 확인했다.
 */
export const HERO_CHARACTERS: readonly HeroCharacter[] = [
  {
    src: '/images/home/chars/pixchar-right.gif',
    x: 1151,
    y: 78,
    width: 201,
    height: 152,
  },
  {
    src: '/images/home/chars/mushroom.gif',
    x: 1118.63,
    y: 348.4,
    width: 160.73,
    height: 160.73,
  },
  {
    src: '/images/home/chars/pixchar-left.gif',
    x: 130,
    y: 158,
    width: 124.19,
    height: 211.33,
    mirrored: true,
  },
  {
    src: '/images/home/chars/boy.gif',
    x: 209,
    y: 465,
    width: 235,
    height: 214,
    mirrored: true,
  },
]

/**
 * 시안 px 좌표를 프레임 대비 % 로 바꾼다.
 *
 * 캐릭터 레이어는 1440×760 비율(`aspect-[1440/760]`)을 유지하므로 가로 %·세로 %
 * 가 같은 배율로 줄어든다. 덕분에 어떤 폭에서도 배경과 같은 비율로 축소되고,
 * 레이어 밖으로 밀려나 잘리는 픽셀이 생기지 않는다.
 */
export function heroCharacterStyle(character: HeroCharacter): CSSProperties {
  const percent = (value: number, total: number) => `${(value / total) * 100}%`

  return {
    left: percent(character.x, HERO_FRAME.width),
    top: percent(character.y, HERO_FRAME.height),
    width: percent(character.width, HERO_FRAME.width),
    height: percent(character.height, HERO_FRAME.height),
  }
}
