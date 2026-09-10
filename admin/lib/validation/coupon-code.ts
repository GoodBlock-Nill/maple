/**
 * 쿠폰 코드의 모양 · 정규화 · 자동 생성.
 *
 * 코드는 사람이 **읽어서 옮겨 적는** 값이다(공지·이벤트 배너·오프라인 인쇄물).
 * 그래서 두 가지를 코드가 직접 책임진다.
 *
 *   1. 헷갈리는 글자를 아예 만들지 않는다 — `0/O` · `1/I` 는 손글씨·저해상도에서
 *      구분되지 않아 "코드가 안 먹는다"는 문의로 돌아온다.
 *   2. 입력은 관대하게 받는다 — 사용자는 소문자로 치고, 붙여넣기에 공백이 섞인다.
 *      DB 의 조회 키(`coupons.code_normalized`)와 **같은 규칙**으로 정규화한다
 *      (마이그레이션 20260910000100: `upper(regexp_replace(code,'[[:space:]]','','g'))`).
 *
 * 하이픈은 지우지 않는다. 지우면 `GLZA-TEST-0001` 과 `GLZAT-EST0-001` 이 같은 코드가
 * 되어 오타로 남의 쿠폰을 등록하게 된다 — DB 쪽 주석과 같은 근거다.
 *
 * 이 파일에는 의존성이 없다(순수 함수). 서버 액션·다이얼로그·유닛 테스트가 함께 쓴다.
 */

export const COUPON_CODE_MIN_LENGTH = 4
export const COUPON_CODE_MAX_LENGTH = 32

/** DB 의 `coupons_code_shape` CHECK 와 같은 정규식이어야 한다. */
export const COUPON_CODE_PATTERN = /^[A-Z0-9][A-Z0-9-]{3,31}$/

/** 자동 생성에서 제외하는 글자. 손으로 옮겨 적을 때 서로 뒤바뀐다. */
export const AMBIGUOUS_CODE_CHARS = ['0', 'O', '1', 'I'] as const

/** 생성용 알파벳 — 대문자 + 숫자에서 위 넷을 뺀 32자. */
export const COUPON_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

/** 자동 생성 코드의 접두사. 어디서 온 코드인지 로그·문의에서 한눈에 보이게 한다. */
export const COUPON_CODE_PREFIX = 'GLZA'

const SEGMENT_LENGTH = 4
const SEGMENT_COUNT = 2

/**
 * 입력 → 조회 키.
 *
 * `upper` + 모든 공백 제거. DB 의 생성 열과 한 글자도 다르면 안 된다 — 다르면
 * 관리자 화면에서 만든 코드를 사용자가 넣었을 때 조용히 `invalid_code` 가 된다.
 */
export function normalizeCouponCode(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\s+/g, '').toUpperCase()
}

/** 정규화한 값이 DB 제약을 통과하는가. */
export function isCouponCode(value: string): boolean {
  return COUPON_CODE_PATTERN.test(value)
}

/** 코드에 헷갈리는 글자가 섞였는가. 수동 입력에는 경고만 하고 막지는 않는다. */
export function hasAmbiguousCodeChars(value: string): boolean {
  return AMBIGUOUS_CODE_CHARS.some((char) => value.includes(char))
}

/**
 * `GLZA-XXXX-XXXX` 한 장.
 *
 * 난수 공급자를 인자로 받는 이유는 테스트다. `Math.random` 을 직접 부르면 "헷갈리는
 * 글자가 절대 나오지 않는다"를 확률로만 확인하게 된다 — 경계를 고정할 수 없다.
 *
 * @param random 0 이상 1 미만의 수를 돌려주는 함수.
 */
export function generateCouponCode(random: () => number = Math.random): string {
  const segments: string[] = []

  for (let index = 0; index < SEGMENT_COUNT; index += 1) {
    let segment = ''

    for (let position = 0; position < SEGMENT_LENGTH; position += 1) {
      const pick = Math.floor(random() * COUPON_CODE_ALPHABET.length)
      // 공급자가 1 을 돌려주거나 음수를 주더라도 알파벳 밖으로 나가지 않게 좁힌다.
      const safe = Math.min(Math.max(pick, 0), COUPON_CODE_ALPHABET.length - 1)

      segment += COUPON_CODE_ALPHABET[safe]
    }

    segments.push(segment)
  }

  return [COUPON_CODE_PREFIX, ...segments].join('-')
}
