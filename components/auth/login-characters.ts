/**
 * 로그인 화면(v2 시안, Figma 2UmKcpmy55IqMZ7Sg6vTeW)의 캐릭터 배치.
 *
 * 시안의 캐릭터 2종은 **정지 PNG** 다(Plugin API 확인). 말풍선·그림자 타원은
 * 자산이 아니라 CSS 로 그린다 — 글자가 그대로 선택·확대되고, 폰트가 바뀌어도
 * 말풍선이 함께 늘어난다.
 *
 * 좌표는 1440×868(본문 섹션) 기준 px 이며 `place()` 가 % 로 환산한다. 무대는
 * 1440 폭으로 고정해 가운데 정렬하므로(LoginCharacters) 환산값은 어느 폭에서도
 * 같은 자리를 가리킨다 — 본문 블록도 같은 중심선을 쓰기 때문에 화면이 좁아져도
 * 캐릭터가 글자 위로 파고들지 않는다.
 *
 * 사양: `docs/reference/figma/auth-v2-spec.md` §PC 캐릭터
 */

/** 무대 크기 = 시안 폭 × 본문 섹션 높이(푸터가 시작하는 y). */
export const LOGIN_STAGE_WIDTH = 1440
export const LOGIN_STAGE_HEIGHT = 868

type Placement = {
  left: string
  top: string
  width: string
  height: string
}

function place(x: number, y: number, w: number, h: number): Placement {
  const pct = (value: number, total: number): string => `${((value / total) * 100).toFixed(6)}%`

  return {
    left: pct(x, LOGIN_STAGE_WIDTH),
    top: pct(y, LOGIN_STAGE_HEIGHT),
    width: pct(w, LOGIN_STAGE_WIDTH),
    height: pct(h, LOGIN_STAGE_HEIGHT),
  }
}

export type SpeechBubble = {
  /** 줄바꿈 위치가 시안 그대로여야 해서 줄 단위로 담는다. */
  lines: readonly string[]
  placement: Placement
  /** 말풍선 아래 꼬리(10×6). 말풍선과 같은 무대 좌표계에 둔다. */
  tail: Placement
}

export type CharacterShadow = Placement

export type LoginCharacter = {
  /** 말풍선 문구를 그대로 쓴다 — 장식이라 alt 는 비우고 key 로만 쓴다. */
  id: string
  src: string
  /** PNG 원본 픽셀. `width`/`height` 속성으로 넘겨 비율 경고를 막는다. */
  naturalWidth: number
  naturalHeight: number
  placement: Placement
  bubble: SpeechBubble
  /** 발밑 타원(#e6e9ed). 오른쪽 캐릭터는 슬라임까지 두 개다. */
  shadows: readonly CharacterShadow[]
}

/** 시안 Group 225 · Group 226. */
export const LOGIN_CHARACTERS: readonly LoginCharacter[] = [
  {
    id: 'left',
    src: '/images/auth-v2/char-left.png',
    naturalWidth: 1236,
    naturalHeight: 1272,
    placement: place(325, 229, 175, 180),
    bubble: {
      lines: ['어서오세요!', '글자월드에요!'],
      placement: place(373, 170, 112, 64),
      /* 꼬리는 말풍선 오른쪽으로 치우쳐 있다(시안 x=463, 말풍선 끝에서 12px 안쪽). */
      tail: place(463, 234, 10, 6),
    },
    shadows: [place(351, 384, 100, 12)],
  },
  {
    id: 'right',
    src: '/images/auth-v2/char-right.png',
    naturalWidth: 1312,
    naturalHeight: 1199,
    placement: place(940, 475, 205, 187),
    bubble: {
      lines: ['로그인하고', '더 많은 이야기를', '만나보세요!'],
      placement: place(1004, 409, 127, 84),
      /* 꼬리는 말풍선 왼쪽으로 치우쳐 있다(시안 x=1016, 말풍선 끝에서 12px 안쪽). */
      tail: place(1016, 493, 10, 6),
    },
    shadows: [place(1004, 633, 75, 14), place(1073, 635, 65, 15)],
  },
]
