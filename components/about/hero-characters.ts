/**
 * 소개 히어로의 캐릭터 GIF 배치.
 *
 * 시안(Figma 509:2958)의 캐릭터는 전부 애니메이션 GIF 라 정지 합성본을 쓰면
 * 움직임이 사라진다. 나무 단상·풀숲만 `hero-stage.png` 로 깔고 그 위에 GIF 를
 * 개별 배치한다. 좌표는 1440×1017 프레임 기준 px 이며, 컨테이너가 뷰포트 폭에
 * 비례해 줄어들도록 % 로 환산해 둔다(어떤 폭에서도 비율이 유지된다).
 *
 * 사양: `docs/reference/figma/about-gif-spec.md`
 */

/** 캐릭터 프레임 크기(시안). */
export const HERO_FRAME_WIDTH = 1440
export const HERO_FRAME_HEIGHT = 1017

export type HeroCharacter = {
  src: string
  /** GIF 원본 픽셀 크기. `width`/`height` 속성으로 그대로 넘긴다. */
  naturalWidth: number
  naturalHeight: number
  /** 프레임(1440×1017) 기준 배치 — % 문자열. */
  left: string
  top: string
  width: string
  height: string
  /** Figma 의 수평 반전(scale-y -1 + rotate 180). */
  isFlipped: boolean
}

function place(
  x: number,
  y: number,
  w: number,
  h: number,
): Pick<HeroCharacter, 'left' | 'top' | 'width' | 'height'> {
  const pct = (value: number, total: number): string => `${((value / total) * 100).toFixed(6)}%`

  return {
    left: pct(x, HERO_FRAME_WIDTH),
    top: pct(y, HERO_FRAME_HEIGHT),
    width: pct(w, HERO_FRAME_WIDTH),
    height: pct(h, HERO_FRAME_HEIGHT),
  }
}

/** 왼쪽 → 오른쪽 순서. 마지막 버섯만 프레임 오른쪽 경계를 23px 넘는다(시안 동일). */
export const HERO_CHARACTERS: readonly HeroCharacter[] = [
  {
    src: '/images/about/chars/c2-rabbits.gif',
    naturalWidth: 119,
    naturalHeight: 80,
    ...place(13.31, 502.03, 229, 153.95),
    isFlipped: true,
  },
  {
    src: '/images/about/chars/c3-balloons.gif',
    naturalWidth: 105,
    naturalHeight: 94,
    ...place(256.07, 502.03, 171.5, 153.53),
    isFlipped: false,
  },
  {
    src: '/images/about/chars/c1-camera-cat.gif',
    naturalWidth: 70,
    naturalHeight: 72,
    ...place(394.87, 532.84, 119.31, 122.72),
    isFlipped: true,
  },
  {
    src: '/images/about/chars/c4-propeller.gif',
    naturalWidth: 72,
    naturalHeight: 52,
    ...place(562.18, 502.03, 174.82, 126.26),
    isFlipped: false,
  },
  {
    src: '/images/about/chars/c5-girl.gif',
    naturalWidth: 51,
    naturalHeight: 74,
    ...place(783, 532, 85.15, 123.56),
    isFlipped: false,
  },
  {
    src: '/images/about/chars/c6-band.gif',
    naturalWidth: 193,
    naturalHeight: 90,
    ...place(838.67, 507.42, 317.67, 148.14),
    isFlipped: true,
  },
  {
    src: '/images/about/chars/c7-mushroom.gif',
    naturalWidth: 150,
    naturalHeight: 131,
    ...place(1165.78, 394.75, 297.43, 259.76),
    isFlipped: false,
  },
]
