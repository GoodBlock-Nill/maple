import { describe, expect, it } from 'vitest'

import {
  buildHref,
  DEFAULT_PAGE_SIZE,
  firstValue,
  pageRange,
  parsePage,
  parseSort,
  serializeSort,
  sortHref,
  totalPages,
} from '@/lib/utils/table-query'

const ALLOWED = ['created_at', 'title'] as const
const FALLBACK = { key: 'created_at', direction: 'desc' } as const

describe('parseSort', () => {
  it('should fall back when the parameter is missing', () => {
    expect(parseSort(undefined, ALLOWED, FALLBACK)).toEqual(FALLBACK)
  })

  it('should fall back when the key is not allowed', () => {
    // 허용 목록 밖의 컬럼을 그대로 쓰면 임의 컬럼 정렬이 열린다.
    expect(parseSort('password:asc', ALLOWED, FALLBACK)).toEqual(FALLBACK)
  })

  it('should parse an allowed key and direction', () => {
    expect(parseSort('title:asc', ALLOWED, FALLBACK)).toEqual({ key: 'title', direction: 'asc' })
  })

  it('should treat any direction other than asc as desc', () => {
    expect(parseSort('title:sideways', ALLOWED, FALLBACK)).toEqual({
      key: 'title',
      direction: 'desc',
    })
  })

  it('should round-trip through serializeSort', () => {
    const sort = parseSort('title:asc', ALLOWED, FALLBACK)

    expect(serializeSort(sort)).toBe('title:asc')
  })
})

describe('parsePage', () => {
  it('should default to the first page', () => {
    expect(parsePage(undefined)).toBe(1)
    expect(parsePage('')).toBe(1)
  })

  it('should reject zero and negative pages', () => {
    expect(parsePage('0')).toBe(1)
    expect(parsePage('-3')).toBe(1)
  })

  it('should reject non-numeric input', () => {
    expect(parsePage('two')).toBe(1)
  })

  it('should read a valid page', () => {
    expect(parsePage('4')).toBe(4)
  })
})

describe('pageRange', () => {
  it('should start at zero on the first page', () => {
    expect(pageRange(1)).toEqual([0, DEFAULT_PAGE_SIZE - 1])
  })

  it('should offset by a full page thereafter', () => {
    expect(pageRange(3, 10)).toEqual([20, 29])
  })
})

describe('totalPages', () => {
  it('should return one page when there is nothing to show', () => {
    expect(totalPages(0)).toBe(1)
  })

  it('should round up a partial page', () => {
    expect(totalPages(21, 20)).toBe(2)
  })
})

describe('buildHref', () => {
  it('should keep existing parameters', () => {
    expect(buildHref('/members', { q: '홍길동' }, { page: '2' })).toBe('/members?q=%ED%99%8D%EA%B8%B8%EB%8F%99&page=2')
  })

  it('should delete a parameter when the patch value is null', () => {
    expect(buildHref('/members', { q: 'a', page: '3' }, { page: null })).toBe('/members?q=a')
  })

  it('should drop the question mark when nothing remains', () => {
    expect(buildHref('/members', {}, {})).toBe('/members')
  })

  it('should use only the first value of a repeated parameter', () => {
    expect(buildHref('/members', { q: ['a', 'b'] }, {})).toBe('/members?q=a')
  })
})

describe('sortHref', () => {
  it('should flip to ascending when the same key is already descending', () => {
    expect(sortHref('/members', {}, { key: 'created_at', direction: 'desc' }, 'created_at')).toBe(
      '/members?sort=created_at%3Aasc',
    )
  })

  it('should start a new key at descending', () => {
    expect(sortHref('/members', {}, { key: 'created_at', direction: 'asc' }, 'nickname')).toBe(
      '/members?sort=nickname%3Adesc',
    )
  })

  it('should return to the first page when sorting changes', () => {
    const href = sortHref('/members', { page: '5' }, { key: 'created_at', direction: 'asc' }, 'nickname')

    expect(href).not.toContain('page=')
  })
})

describe('firstValue', () => {
  it('should unwrap arrays', () => {
    expect(firstValue(['a', 'b'])).toBe('a')
  })

  it('should treat empty values as absent', () => {
    expect(firstValue('')).toBeNull()
    expect(firstValue(undefined)).toBeNull()
    expect(firstValue([])).toBeNull()
  })
})
