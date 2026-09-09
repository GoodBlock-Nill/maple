/**
 * 이메일 문의의 인증 판정(SPF · DKIM · DMARC) 해석.
 *
 * 값은 수신 제공자가 준 판정을 `jsonb` 로 **그대로** 담아 둔 것이라 모양을 보장할 수
 * 없다(제공자를 바꾸면 키가 늘거나 대소문자가 달라진다). 그래서 화면에 닿기 전에
 * 여기서 한 번 좁힌다 — 깨진 값 하나가 문의 상세 전체를 못 열게 만들면 안 된다.
 *
 * 순수 함수만 둔다(네트워크·DB 없음). `admin/tests/unit/inquiry-email-auth.test.ts` 가 고정한다.
 */

export type InquiryEmailAuth = {
  spf: string | null
  dkim: string | null
  dmarc: string | null
}

/** 판정 실패로 읽는 값. 제공자 공통 표기다(`pass` · `fail` · `none` · `neutral` …). */
const FAIL = 'fail'

function readVerdict(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim().toLowerCase() : null
}

/** 배열·문자열·null 등 예상 밖의 값은 전부 `null` 로 떨어뜨린다(화면은 '판정 없음'으로 그린다). */
export function parseEmailAuth(value: unknown): InquiryEmailAuth | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>

  return {
    spf: readVerdict(record.spf),
    dkim: readVerdict(record.dkim),
    dmarc: readVerdict(record.dmarc),
  }
}

/**
 * 셋 중 **하나라도** 실패면 목록에 '인증 실패' 뱃지를 세운다.
 *
 * 판정이 없는 것(`none` · null)은 실패로 보지 않는다 — 도메인이 레코드를 두지 않은
 * 정상적인 메일까지 의심스럽게 보이면 뱃지가 곧 의미를 잃는다.
 */
export function hasEmailAuthFailure(value: unknown): boolean {
  const auth = parseEmailAuth(value)

  if (auth === null) {
    return false
  }

  return auth.spf === FAIL || auth.dkim === FAIL || auth.dmarc === FAIL
}
