import { firstValue } from '@/lib/utils/table-query'

/**
 * 문의 목록 필터 **값 하나하나**의 정리 규칙.
 *
 * `validation/inquiries.ts` 에서 떼어 낸 것은 '회원 답장 도착만' 필터가 붙으면서 그
 * 파일이 300줄 상한에 닿았기 때문이다(출처 · 계정 마스킹을 뗀 것과 같은 이유).
 * 화면과 스키마는 계속 `@/lib/validation/inquiries` 한 곳에서 가져다 쓴다 —
 * 그쪽이 이 파일을 다시 내보낸다.
 */

/**
 * 카테고리 필터 값의 상한. DB CHECK(`inquiry_categories_label_length`)와 같은 숫자다.
 *
 * 옵션 목록은 DB(`inquiry_categories`) + 데이터에 남은 옛 라벨이라 여기서 고정 배열로
 * 검사할 수 없다. 대신 "라벨일 수 없는 값"만 걸러 낸다 — 필터는 `eq()` 로만 쓰이므로
 * 임의 문자열이 질의 문법으로 해석되지는 않지만, 길이가 상한을 넘는 값은 어떤 행과도
 * 맞지 않아 필터로서 의미가 없다.
 */
export const INQUIRY_CATEGORY_MAX_LENGTH = 20

/**
 * 유형 필터 값의 상한. DB CHECK(`inquiry_categories_subtypes_shape`)의 항목 길이와
 * 같은 숫자다. 옵션 목록은 DB(세부 유형) + 데이터에 남은 옛 값이라 고정 배열로
 * 검사할 수 없어, 카테고리와 같은 규칙으로 "유형일 수 없는 값"만 걸러 낸다.
 */
export const INQUIRY_TYPE_MAX_LENGTH = 30

export const INQUIRY_SEARCH_MAX_LENGTH = 60

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

/* `profiles.id` 는 uuid 다. 모양이 아닌 값은 필터를 걸지 않는다(= 전체) — 회원
   상세("전체 보기")가 항상 uuid 를 실어 보내므로 실사용에서는 걸릴 일이 없고,
   임의 문자열이 `eq()` 값으로 그대로 흘러가는 것만 막으면 된다. */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 검색어 정리.
 *
 * PostgREST 의 `or(...)` 는 쉼표·괄호를 **문법**으로 읽고, ilike 패턴에서 `%`·`_` 는
 * 와일드카드다. 그대로 흘려보내면 검색어 하나로 질의가 깨지거나 의도치 않은
 * 전체 스캔이 된다. 서식 문자는 지우고 길이도 자른다.
 */
export function sanitizeInquirySearch(raw: string | string[] | undefined): string | null {
  const value = firstValue(raw)

  if (value === null) {
    return null
  }

  const cleaned = value
    .replace(/[,()%_*\\"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, INQUIRY_SEARCH_MAX_LENGTH)

  return cleaned === '' ? null : cleaned
}

/** 카테고리 필터 값 정리. 옵션 목록은 DB 가 소유하므로 모양만 본다. */
export function sanitizeInquiryCategory(raw: string | null): string | null {
  const value = (raw ?? '').trim()

  return value === '' || value.length > INQUIRY_CATEGORY_MAX_LENGTH ? null : value
}

/** 유형(세부 문의 유형) 필터 값 정리. 카테고리와 같은 규칙이다. */
export function sanitizeInquiryType(raw: string | null): string | null {
  const value = (raw ?? '').trim()

  return value === '' || value.length > INQUIRY_TYPE_MAX_LENGTH ? null : value
}

/** `YYYY-MM-DD`(한국시간 기준 날짜)만 통과시킨다. 데이터 계층이 UTC 경계로 환산한다. */
export function parseInquiryDateParam(raw: string | string[] | undefined): string | null {
  const value = firstValue(raw)

  if (value === null || !DATE_PATTERN.test(value)) {
    return null
  }

  return Number.isNaN(new Date(`${value}T00:00:00Z`).getTime()) ? null : value
}

/** 회원 스코프(`?user=<uuid>`). 모양이 아니면 필터를 걸지 않는다(= 전체 회원). */
export function parseInquiryUserIdParam(raw: string | string[] | undefined): string | null {
  const value = firstValue(raw)

  return value !== null && UUID_PATTERN.test(value) ? value : null
}

/**
 * '회원 답장 도착만' 필터(`?awaiting=1`).
 *
 * 값은 **`'1'` 하나만** 켠다. `?awaiting=0` · `?awaiting=false` 를 참으로 읽는 파서는
 * 운영자가 주소를 손으로 고칠 때 반드시 배신한다(존재만으로 켜지는 파서도 같다).
 * 체크박스는 꺼지면 아무것도 보내지 않으므로 이 규칙으로 충분하다.
 */
export function parseInquiryAwaitingParam(raw: string | string[] | undefined): boolean {
  return firstValue(raw) === '1'
}
