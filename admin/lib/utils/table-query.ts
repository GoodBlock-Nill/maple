/**
 * 목록 URL 상태(정렬·페이지·필터) 헬퍼.
 *
 * 테이블은 자체 상태를 갖지 않는다. 정렬과 페이지는 전부 쿼리스트링에 적어
 * 새로고침·뒤로가기·링크 공유가 모두 같은 화면을 재현하게 한다. 헤더와
 * 페이지네이션이 `<Link>` 로만 동작하므로 자바스크립트 없이도 목록이 움직인다.
 */

export type SortDirection = 'asc' | 'desc'

export type SortState = {
  key: string
  direction: SortDirection
}

/** 목록 페이지가 받는 `searchParams` 의 모양(Next 16 은 배열도 준다). */
export type QueryParams = Record<string, string | string[] | undefined>

export const DEFAULT_PAGE_SIZE = 20

/** `?sort=created_at:desc` 를 파싱한다. 허용 키 밖의 값은 기본값으로 떨어진다. */
export function parseSort(
  raw: string | string[] | undefined,
  allowedKeys: readonly string[],
  fallback: SortState,
): SortState {
  const value = firstValue(raw)

  if (value === null) {
    return fallback
  }

  const [key, direction] = value.split(':')

  if (key === undefined || !allowedKeys.includes(key)) {
    return fallback
  }

  return { key, direction: direction === 'asc' ? 'asc' : 'desc' }
}

export function serializeSort(sort: SortState): string {
  return `${sort.key}:${sort.direction}`
}

/** `?page=3` 을 1 이상의 정수로 좁힌다. */
export function parsePage(raw: string | string[] | undefined): number {
  const value = firstValue(raw)

  if (value === null) {
    return 1
  }

  const page = Number.parseInt(value, 10)

  return Number.isFinite(page) && page >= 1 ? page : 1
}

export function totalPages(count: number, pageSize: number = DEFAULT_PAGE_SIZE): number {
  if (count <= 0 || pageSize <= 0) {
    return 1
  }

  return Math.max(1, Math.ceil(count / pageSize))
}

/** Supabase `range()` 에 넣을 [from, to]. */
export function pageRange(page: number, pageSize: number = DEFAULT_PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize

  return [from, from + pageSize - 1]
}

/**
 * 현재 쿼리를 유지한 채 일부 키만 바꾼 URL 을 만든다.
 * 값이 `null` 이면 그 키를 지운다(예: 정렬 해제, 1페이지로 복귀).
 */
export function buildHref(
  pathname: string,
  current: QueryParams,
  patch: Record<string, string | null>,
): string {
  const params = new URLSearchParams()

  for (const [key, value] of Object.entries(current)) {
    const single = firstValue(value)

    if (single !== null) {
      params.set(key, single)
    }
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      params.delete(key)
    } else {
      params.set(key, value)
    }
  }

  const query = params.toString()

  return query === '' ? pathname : `${pathname}?${query}`
}

/** 헤더 클릭 시 갈 곳: 같은 키면 방향을 뒤집고, 다른 키면 내림차순으로 시작한다. */
export function sortHref(
  pathname: string,
  current: QueryParams,
  activeSort: SortState,
  key: string,
): string {
  const direction: SortDirection =
    activeSort.key === key && activeSort.direction === 'desc' ? 'asc' : 'desc'

  // 정렬이 바뀌면 보고 있던 페이지 번호는 의미를 잃는다. 항상 1페이지로 돌아간다.
  return buildHref(pathname, current, { sort: serializeSort({ key, direction }), page: null })
}

/** Next 는 같은 키가 반복되면 배열을 준다. 화면은 항상 첫 값만 쓴다. */
export function firstValue(raw: string | string[] | undefined): string | null {
  if (Array.isArray(raw)) {
    return raw[0] ?? null
  }

  return raw === undefined || raw === '' ? null : raw
}
