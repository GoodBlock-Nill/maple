import { accumulatedCount } from '@/lib/utils/pagination'

import type { ListResult } from '@/types/domain'

/**
 * 목록 질의 헬퍼.
 *
 * 화면의 "더보기"는 페이지네이션이 아니라 **누적 로드**다. `?page=N` 은 1~N
 * 페이지 분량을 한 번에 보여주므로, 서버는 매번 `range(0, N*pageSize - 1)` 로
 * 처음부터 다시 읽는다. 전체 건수는 `count: 'exact'` 로 같은 왕복에서 받는다.
 */

export type RangeBounds = {
  /** `range()` 의 시작 인덱스(0-based, 포함). */
  from: number
  /** `range()` 의 끝 인덱스(0-based, 포함). */
  to: number
}

/**
 * 누적 목록이 요청할 `range()` 경계.
 *
 * `offset` 은 랭킹처럼 앞쪽 N건(TOP3)을 표에서 제외하고 세는 목록을 위한 값이다.
 * 그 경우에도 상단 카드가 필요하므로 조회 자체는 0번 행부터 시작한다.
 */
export function accumulatedRange(page: number, pageSize: number, offset = 0): RangeBounds {
  const safePage = Number.isFinite(page) && page > 1 ? Math.floor(page) : 1
  const safeSize = pageSize > 0 ? pageSize : 1

  return { from: 0, to: offset + safePage * safeSize - 1 }
}

/**
 * 번호 페이지네이션이 요청할 `range()` 경계 — **그 페이지만** 읽는다.
 *
 * 누적 목록(`accumulatedRange`)과 달리 앞 페이지를 다시 읽지 않는다. 두 함수를
 * 나란히 두는 이유는 목록마다 방식이 다르기 때문이다(내 문의 내역만 번호 방식).
 */
export function pageRange(page: number, pageSize: number): RangeBounds {
  const safePage = Number.isFinite(page) && page > 1 ? Math.floor(page) : 1
  const safeSize = pageSize > 0 ? pageSize : 1
  const from = (safePage - 1) * safeSize

  return { from, to: from + safeSize - 1 }
}

/**
 * `ilike` 패턴에 들어갈 사용자 입력을 리터럴로 만든다.
 *
 * PostgreSQL 의 `ILIKE` 는 `%`(임의 문자열) · `_`(임의 1글자)를 와일드카드로,
 * `\` 를 이스케이프 문자로 해석한다. 그대로 넘기면 `_` 하나로 전체 목록이
 * 걸려 검색이 무력화된다.
 *
 * PostgREST 는 like/ilike 패턴의 `*` 를 `%` 로 치환한다(문서화된 편의 기능).
 * 이스케이프 수단이 없어 리터럴 `*` 검색은 지원할 수 없으므로 제거한다.
 */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`).replace(/\*/g, '')
}

/** `%검색어%` 부분일치 패턴. 빈 문자열이면 null(= 필터 미적용)을 돌려준다. */
export function containsPattern(query: string): string | null {
  const trimmed = query.trim()

  if (trimmed.length === 0) {
    return null
  }

  return `%${escapeLikePattern(trimmed)}%`
}

/**
 * `count: 'exact'` 응답을 화면이 쓰는 `ListResult` 로 정규화한다.
 * `count` 가 null 로 오는 경우(카운트 실패)는 받은 행 수를 전체로 간주한다.
 */
export function toListResult<TItem>(
  items: readonly TItem[],
  count: number | null,
  page: number,
  pageSize: number,
): ListResult<TItem> {
  const total = count ?? items.length
  const shown = Math.min(items.length, accumulatedCount(page, pageSize, total))

  return { items, total, shown, page, hasMore: shown < total }
}

/**
 * 번호 페이지네이션 응답의 `ListResult`.
 *
 * `shown` 은 **이 페이지에 그린 건수**다(누적이 아니다). 다음 페이지가 있는지는
 * 건수가 아니라 페이지 경계로 판단해야 한다 — 마지막 페이지가 덜 찬 목록에서
 * `shown < total` 로 보면 영원히 "더 있다"가 된다.
 */
export function toPagedListResult<TItem>(
  items: readonly TItem[],
  count: number | null,
  page: number,
  pageSize: number,
): ListResult<TItem> {
  const total = count ?? items.length
  const safePage = Number.isFinite(page) && page > 1 ? Math.floor(page) : 1

  return {
    items,
    total,
    shown: items.length,
    page: safePage,
    hasMore: safePage * pageSize < total,
  }
}
