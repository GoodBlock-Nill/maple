const VISIBLE_LENGTH = 3
const MASK = '***'

/**
 * 닉네임 마스킹. 앞 3자만 남기고 `***` 를 붙인다(`cinnamon` → `cin***`).
 * 3자 미만이면 있는 만큼만 남긴다.
 */
export function maskNickname(nickname: string): string {
  const trimmed = nickname.trim()

  if (trimmed.length === 0) {
    return MASK
  }

  return `${trimmed.slice(0, VISIBLE_LENGTH)}${MASK}`
}

const ACCOUNT_VISIBLE_PREFIX = 4
const ACCOUNT_VISIBLE_SUFFIX = 3
const ACCOUNT_MASK = '****'
const EMPTY_PLACEHOLDER = '-'

/**
 * 계정 ID 마스킹(`123456789000000` → `1234****000`).
 *
 * 본인 확인용으로 "내가 어떤 ID 로 접수했는지" 알아볼 정도만 남긴다. 마스크 길이를
 * 원문 길이에 맞추지 않는 이유는 어깨너머로 자릿수까지 새어 나가지 않게 하려는 것이다.
 * 값이 없으면 화면에서 빈칸이 되지 않도록 `-` 를 돌려준다.
 */
export function maskAccountId(accountId: string | null | undefined): string {
  const trimmed = (accountId ?? '').trim()

  if (trimmed.length === 0) {
    return EMPTY_PLACEHOLDER
  }

  if (trimmed.length <= ACCOUNT_VISIBLE_PREFIX + ACCOUNT_VISIBLE_SUFFIX) {
    return `${trimmed.slice(0, 1)}${ACCOUNT_MASK}`
  }

  return `${trimmed.slice(0, ACCOUNT_VISIBLE_PREFIX)}${ACCOUNT_MASK}${trimmed.slice(-ACCOUNT_VISIBLE_SUFFIX)}`
}
