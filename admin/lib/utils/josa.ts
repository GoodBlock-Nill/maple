/**
 * 한국어 조사 선택.
 *
 * 운영 문구에 `을(를)` · `이(가)` 를 쓰면 읽는 사람이 매번 괄호를 골라 읽어야 한다.
 * 대상 이름은 대부분 사용자가 입력한 값(배너 제목 · 아이템 이름)이라 문구를 미리
 * 확정할 수 없으므로, 앞 글자의 받침을 보고 코드가 고른다.
 *
 * 한글 음절은 유니코드에서 `((초성 × 21) + 중성) × 28 + 종성` 로 배열돼 있다.
 * 그래서 `(코드 - 가) % 28` 이 0 이 아니면 받침이 있고, 8 이면 그 받침이 'ㄹ' 이다.
 */

/** 각 조사의 [받침 있음, 받침 없음] 짝. */
const FORMS = {
  을: ['을', '를'],
  이: ['이', '가'],
  은: ['은', '는'],
  과: ['과', '와'],
  로: ['으로', '로'],
} as const

export type JosaKind = keyof typeof FORMS

const HANGUL_FIRST = 0xac00
const HANGUL_LAST = 0xd7a3
const JONGSEONG_COUNT = 28
/** 종성 인덱스 8 = 'ㄹ'. '로' 만 이 받침을 받침 없음처럼 다룬다(서울로 · 학교로). */
const RIEUL = 8

/**
 * 숫자를 한국어로 읽었을 때의 끝 받침(종성 인덱스). "2" 는 '이'(받침 없음),
 * "3" 은 '삼'(ㅁ) 처럼 읽으므로 `가져오기2를` · `3차를` 이 아니라 `3차을` 로 붙는다.
 * 0 영(ㅇ=21) · 1 일(ㄹ) · 2 이 · 3 삼(ㅁ=16) · 4 사 · 5 오 · 6 육(ㄱ=1) · 7 칠(ㄹ) · 8 팔(ㄹ) · 9 구.
 */
const DIGIT_FINAL: Record<string, number> = {
  '0': 21,
  '1': RIEUL,
  '2': 0,
  '3': 16,
  '4': 0,
  '5': 0,
  '6': 1,
  '7': RIEUL,
  '8': RIEUL,
  '9': 0,
}

/** 마지막 글자의 종성 인덱스. 한글 음절·숫자가 아니면 null. */
function finalConsonant(word: string): number | null {
  const last = word.trim().at(-1)

  if (last === undefined) {
    return null
  }

  const digitFinal = DIGIT_FINAL[last]

  if (digitFinal !== undefined) {
    return digitFinal
  }

  const code = last.codePointAt(0)

  if (code === undefined || code < HANGUL_FIRST || code > HANGUL_LAST) {
    return null
  }

  return (code - HANGUL_FIRST) % JONGSEONG_COUNT
}

/**
 * `word` 뒤에 붙일 조사만 돌려준다(단어는 붙이지 않는다).
 *
 * 숫자는 한국어 읽기(일·이·삼…)의 받침을 따른다. 영문처럼 읽는 법이 갈리는 끝 글자는
 * 앞쪽 형태로 떨어뜨린다 — 표기를 한 가지로 고정해 화면 간 흔들림을 없앤다.
 *
 * @example `${name}${josa(name, '을')} 삭제했습니다.` → '메이플을 삭제했습니다.'
 */
export function josa(word: string, kind: JosaKind): string {
  const [withFinal, withoutFinal] = FORMS[kind]
  const final = finalConsonant(word)

  if (final === null) {
    return withFinal
  }

  if (kind === '로') {
    return final === 0 || final === RIEUL ? withoutFinal : withFinal
  }

  return final === 0 ? withoutFinal : withFinal
}
