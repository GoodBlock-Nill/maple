import { SEARCH_MAX_LENGTH } from '@/lib/constants/field-limits'
import { firstValue, parsePage, parseSort, type QueryParams } from '@/lib/utils/table-query'
import {
  MEMBER_PROVIDERS,
  MEMBER_STATUS_FILTERS,
  type MemberProvider,
  type MemberStatusFilter,
} from '@/lib/validation/members'

import type { SortState } from '@/lib/utils/table-query'

/**
 * 회원 목록의 쿼리스트링 → 조회 파라미터.
 *
 * 페이지 컴포넌트 안에 두면 테스트가 서버 컴포넌트를 통째로 불러와야 한다. 파싱은
 * 순수 함수이므로 분리해 두고, 허용 목록 밖의 값이 조용히 "전체"로 떨어지는지를
 * 단위 테스트가 고정한다 — 그 규칙이 깨지면 `?status=` 조작으로 필터가 무력화된다.
 */

export type MemberListParams = {
  q: string | null
  status: MemberStatusFilter | null
  provider: MemberProvider | null
  /** 월드 계정 중복 검색. `msw_uid` 또는 프로필 코드와 **정확히** 일치하는 회원만. */
  msw: string | null
  from: string | null
  to: string | null
  sort: SortState
  page: number
}

export const MEMBER_SORT_KEYS = ['created_at', 'nickname'] as const

export const MEMBER_DEFAULT_SORT: SortState = { key: 'created_at', direction: 'desc' }

function clamp(value: string | null): string | null {
  if (value === null) {
    return null
  }

  const trimmed = value.trim().slice(0, SEARCH_MAX_LENGTH)

  return trimmed === '' ? null : trimmed
}

export function parseMemberListParams(params: QueryParams): MemberListParams {
  const status = firstValue(params.status)
  const provider = firstValue(params.provider)

  return {
    q: clamp(firstValue(params.q)),
    status: MEMBER_STATUS_FILTERS.includes(status as MemberStatusFilter)
      ? (status as MemberStatusFilter)
      : null,
    provider: MEMBER_PROVIDERS.includes(provider as MemberProvider)
      ? (provider as MemberProvider)
      : null,
    msw: clamp(firstValue(params.msw)),
    from: firstValue(params.from),
    to: firstValue(params.to),
    sort: parseSort(params.sort, MEMBER_SORT_KEYS, MEMBER_DEFAULT_SORT),
    page: parsePage(params.page),
  }
}
