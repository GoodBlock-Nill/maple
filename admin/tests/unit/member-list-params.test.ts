import { describe, expect, it } from 'vitest'

import { SEARCH_MAX_LENGTH } from '@/lib/constants/field-limits'
import { MEMBER_DEFAULT_SORT, parseMemberListParams } from '@/lib/validation/member-list-params'
import { MEMBER_STATUS_FILTER_LABEL, MEMBER_STATUS_FILTERS } from '@/lib/validation/members'

/**
 * 회원 목록 필터 파싱.
 *
 * 목록 화면의 조건은 전부 쿼리스트링이라 주소창으로 직접 조작할 수 있다. 허용
 * 목록 밖의 값이 조용히 "전체"로 떨어져야 필터가 무력화되지 않는다.
 */

describe('parseMemberListParams — 상태', () => {
  it('should accept every status the filter dropdown offers', () => {
    for (const status of MEMBER_STATUS_FILTERS) {
      expect(parseMemberListParams({ status }).status).toBe(status)
    }
  })

  it('should include the withdrawal states', () => {
    expect(MEMBER_STATUS_FILTERS).toContain('withdrawn')
    expect(MEMBER_STATUS_FILTERS).toContain('purged')
    expect(MEMBER_STATUS_FILTER_LABEL.withdrawn).toBe('탈퇴 대기')
    expect(MEMBER_STATUS_FILTER_LABEL.purged).toBe('삭제됨')
  })

  it('should fall back to 전체 for an unknown status', () => {
    expect(parseMemberListParams({ status: 'deleted' }).status).toBeNull()
    expect(parseMemberListParams({}).status).toBeNull()
  })

  it('should read only the first value when the key repeats', () => {
    expect(parseMemberListParams({ status: ['purged', 'normal'] }).status).toBe('purged')
  })
})

describe('parseMemberListParams — 검색 · 월드 계정', () => {
  it('should trim the search term and drop it when empty', () => {
    expect(parseMemberListParams({ q: '  모험가  ' }).q).toBe('모험가')
    expect(parseMemberListParams({ q: '   ' }).q).toBeNull()
  })

  it('should cut the search term at the shared limit', () => {
    const long = 'ㄱ'.repeat(SEARCH_MAX_LENGTH + 10)

    expect(parseMemberListParams({ q: long }).q).toHaveLength(SEARCH_MAX_LENGTH)
  })

  it('should keep the msw filter as an exact value', () => {
    expect(parseMemberListParams({ msw: ' 1234567890 ' }).msw).toBe('1234567890')
    expect(parseMemberListParams({ msw: '#abcd12' }).msw).toBe('#abcd12')
    expect(parseMemberListParams({}).msw).toBeNull()
  })
})

describe('parseMemberListParams — 정렬 · 페이지', () => {
  it('should default to the newest members first', () => {
    expect(parseMemberListParams({}).sort).toEqual(MEMBER_DEFAULT_SORT)
    expect(parseMemberListParams({ sort: 'email:asc' }).sort).toEqual(MEMBER_DEFAULT_SORT)
  })

  it('should accept the allowed sort keys', () => {
    expect(parseMemberListParams({ sort: 'nickname:asc' }).sort).toEqual({
      key: 'nickname',
      direction: 'asc',
    })
  })

  it('should clamp the page to 1 or higher', () => {
    expect(parseMemberListParams({ page: '0' }).page).toBe(1)
    expect(parseMemberListParams({ page: 'x' }).page).toBe(1)
    expect(parseMemberListParams({ page: '3' }).page).toBe(3)
  })

  it('should keep the provider allow list closed', () => {
    expect(parseMemberListParams({ provider: 'kakao' }).provider).toBe('kakao')
    expect(parseMemberListParams({ provider: 'apple' }).provider).toBeNull()
  })
})
