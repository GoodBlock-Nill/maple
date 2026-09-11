/**
 * 계정 ID 마스킹.
 *
 * 사용자 사이트(`lib/utils/mask.ts`)와 **완전히 같은 규칙**을 쓴다. 같은 계정 ID 가
 * 두 화면에서 다르게 가려지면 운영자와 사용자가 같은 값을 두고 다른 이야기를 하게 된다.
 * 마스크 길이를 원문 길이에 맞추지 않는 것도 그쪽 결정이다 — 자릿수까지 새어 나가지
 * 않게 하려는 것.
 *
 * `inquiries.ts` 에서 떼어 냈다(그쪽이 다시 내보내므로 임포트 경로는 그대로다).
 * 그 파일이 300줄 상한에 닿았고, 마스킹은 문의 도메인과 독립적인 표시 규칙이다.
 */

const ACCOUNT_MASK = '****'
const ACCOUNT_VISIBLE_PREFIX = 4
const ACCOUNT_VISIBLE_SUFFIX = 3

/** `123456789000000` → `1234****000`. 값이 없으면 화면이 비지 않도록 `-`. */
export function maskAccountId(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim()

  if (trimmed.length === 0) {
    return '-'
  }

  if (trimmed.length <= ACCOUNT_VISIBLE_PREFIX + ACCOUNT_VISIBLE_SUFFIX) {
    return `${trimmed.slice(0, 1)}${ACCOUNT_MASK}`
  }

  return `${trimmed.slice(0, ACCOUNT_VISIBLE_PREFIX)}${ACCOUNT_MASK}${trimmed.slice(-ACCOUNT_VISIBLE_SUFFIX)}`
}
