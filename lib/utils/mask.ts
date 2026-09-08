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
