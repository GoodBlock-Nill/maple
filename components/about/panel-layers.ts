/**
 * 양피지 패널 레이어 배치.
 *
 * 시안(Figma 509:2985 / 2993 / 3012 / 529:5880)의 레이어를 그대로 옮긴다.
 * 좌표는 페이지 기준 px 이며 패널 박스(page 59, 1128 · 1341×739) 대비 % 로
 * 환산해 두어 패널이 줄어들어도 구성이 유지된다.
 *
 * 사양: `docs/reference/figma/about-gif-spec.md`
 */

/** 패널 박스(시안). */
const PANEL_LEFT = 59
const PANEL_TOP = 1128
const PANEL_WIDTH = 1341
const PANEL_HEIGHT = 739

export type PanelLayer = {
  src: string
  naturalWidth: number
  naturalHeight: number
  left: string
  top: string
  width: string
  height: string
  isFlipped: boolean
  isAnimated: boolean
}

function place(
  pageX: number,
  pageY: number,
  w: number,
  h: number,
): Pick<PanelLayer, 'left' | 'top' | 'width' | 'height'> {
  const pct = (value: number, total: number): string => `${((value / total) * 100).toFixed(6)}%`

  return {
    left: pct(pageX - PANEL_LEFT, PANEL_WIDTH),
    top: pct(pageY - PANEL_TOP, PANEL_HEIGHT),
    width: pct(w, PANEL_WIDTH),
    height: pct(h, PANEL_HEIGHT),
  }
}

/**
 * 크리에이터 사진 레이어의 로컬(시안) 자산 경로.
 *
 * `site_settings.creator_photo_url` 이 채워지면 이 자리만 원격 이미지로 갈아끼운다.
 * 레이어 배열에서 사진을 골라내야 하므로 상수로 빼서 식별자로 쓴다.
 */
export const PANEL_PHOTO_SRC = '/images/about/panel-photo.png'

/** 아래에서 위 순서(DOM 순서 = 페인트 순서). */
export const PANEL_LAYERS: readonly PanelLayer[] = [
  {
    src: '/images/about/panel-frame.png',
    naturalWidth: 1233,
    naturalHeight: 679,
    ...place(113.3, 1190.45, 1233, 679),
    isFlipped: false,
    isAnimated: false,
  },
  {
    src: PANEL_PHOTO_SRC,
    naturalWidth: 462,
    naturalHeight: 406,
    ...place(152.1, 1327.05, 462, 406),
    isFlipped: false,
    isAnimated: false,
  },
  {
    src: '/images/about/panel-vines.png',
    naturalWidth: 1256,
    naturalHeight: 166,
    ...place(95, 1128, 1256, 166),
    isFlipped: false,
    isAnimated: false,
  },
  {
    /* 파란 젤리. 페이지 왼쪽 밖으로 나가는 부분은 시안에서도 잘린다. */
    src: '/images/about/chars/c8-jelly.gif',
    naturalWidth: 66,
    naturalHeight: 76,
    ...place(-86.6, 1211.13, 276.6, 318.5),
    isFlipped: true,
    isAnimated: true,
  },
]
