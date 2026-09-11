import { firstValue } from '@/lib/utils/table-query'

/**
 * 검색어에서 접수번호 읽기 — `1024` · `#1024` · ` #1024 `.
 *
 * 운영자가 사용자에게 받아 적는 값은 화면에 보이는 그대로(`#1024`)다. 그런데 그
 * 문자열로는 어떤 열도 일치하지 않으므로(제목에 '#1024' 가 들어 있을 리 없다),
 * 숫자만 뽑아 `inquiry_no` 와 **정확히** 비교할 값으로 따로 넘긴다.
 *
 * 제목 검색을 대체하지는 않는다 — 번호 일치는 기존 ilike 조건에 `or` 로 더해진다.
 * "1024" 가 제목에 들어간 문의도 함께 찾을 수 있어야 한다.
 */

/** bigint 를 넘는 값은 질의 자체가 실패한다. 자릿수로 먼저 끊는다. */
const MAX_DIGITS = 15

export function parseInquiryNoSearch(raw: string | string[] | undefined): number | null {
  const value = firstValue(raw)

  if (value === null) {
    return null
  }

  const digits = value.trim().replace(/^#/, '')

  if (!/^\d+$/.test(digits) || digits.length > MAX_DIGITS) {
    return null
  }

  const parsed = Number.parseInt(digits, 10)

  return parsed > 0 ? parsed : null
}
