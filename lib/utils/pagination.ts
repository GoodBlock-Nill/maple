const DEFAULT_PAGE_RANGE_SIZE = 5

export function getPageRange(
  current: number,
  total: number,
  size = DEFAULT_PAGE_RANGE_SIZE,
): number[] {
  if (total <= 0) {
    return []
  }

  if (total <= size) {
    return Array.from({ length: total }, (_, index) => index + 1)
  }

  const half = Math.floor(size / 2)
  let start = current - half
  let end = current + (size - half - 1)

  if (start < 1) {
    end += 1 - start
    start = 1
  }

  if (end > total) {
    start -= end - total
    end = total
  }

  start = Math.max(start, 1)

  return Array.from({ length: end - start + 1 }, (_, index) => start + index)
}

export function getTotalPages(count: number, perPage: number): number {
  if (count <= 0 || perPage <= 0) {
    return 0
  }

  return Math.ceil(count / perPage)
}

export function clampPage(page: number, total: number): number {
  if (total <= 0) {
    return 1
  }

  if (page < 1) {
    return 1
  }

  if (page > total) {
    return total
  }

  return page
}

/**
 * "더보기" 누적 목록 계산.
 * page N 은 1~N 페이지 분량(`page * perPage` 건)을 한 번에 보여준다.
 */
export function accumulatedCount(page: number, perPage: number, total: number): number {
  if (total <= 0 || perPage <= 0) {
    return 0
  }

  const requested = Math.max(page, 1) * perPage

  return Math.min(requested, total)
}
