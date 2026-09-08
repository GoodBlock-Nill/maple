/**
 * URL searchParams ↔ 목록 질의 변환.
 *
 * 목록 필터는 전부 URL에 있으므로 서버 컴포넌트만으로 동작한다.
 * Next.js 16의 `searchParams` 는 `string | string[] | undefined` 를 주므로
 * 항상 이 헬퍼를 거쳐 좁힌 뒤 사용한다.
 */

export type SearchParamValue = string | string[] | undefined

export type SearchParamsRecord = Record<string, SearchParamValue>

/** 배열로 들어온 중복 파라미터(`?a=1&a=2`)는 첫 값만 쓴다. */
export function firstValue(value: SearchParamValue): string | undefined {
  if (Array.isArray(value)) {
    return value[0]
  }

  return value
}

/** 허용 목록에 없으면 `fallback` 으로 되돌린다(잘못된 URL도 404 대신 기본 화면). */
export function parseOption<TValue extends string>(
  value: SearchParamValue,
  allowed: readonly TValue[],
  fallback: TValue,
): TValue {
  const first = firstValue(value)

  return allowed.find((option) => option === first) ?? fallback
}

/** "전체"를 뜻하는 `null` 을 허용하는 카테고리용 파서. */
export function parseOptionalOption<TValue extends string>(
  value: SearchParamValue,
  allowed: readonly TValue[],
): TValue | null {
  const first = firstValue(value)

  return allowed.find((option) => option === first) ?? null
}

/** 1 미만·정수가 아닌 값은 1페이지로 취급한다. */
export function parsePage(value: SearchParamValue): number {
  const parsed = Number.parseInt(firstValue(value) ?? '', 10)

  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1
  }

  return parsed
}

export function parseQuery(value: SearchParamValue): string {
  return (firstValue(value) ?? '').trim()
}

export type HrefQuery = Record<string, string | number | null | undefined>

/**
 * 빈 값(`''`/`null`/`undefined`)과 `page=1` 은 URL에서 생략해 정규화한다.
 * 덕분에 `/news` 와 `/news?page=1` 이 같은 링크로 취급된다.
 */
export function buildHref(pathname: string, query: HrefQuery): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(query)) {
    if (value === null || value === undefined || value === '') {
      continue
    }

    if (key === 'page' && Number(value) <= 1) {
      continue
    }

    search.set(key, String(value))
  }

  const queryString = search.toString()

  return queryString.length > 0 ? `${pathname}?${queryString}` : pathname
}

/** 검색어 매칭. 대소문자·앞뒤 공백 무시. */
export function matchesQuery(query: string, ...fields: readonly string[]): boolean {
  if (query.length === 0) {
    return true
  }

  const needle = query.toLowerCase()

  return fields.some((field) => field.toLowerCase().includes(needle))
}
