import { describe, expect, it } from 'vitest'

import { NEWS_CATEGORY_VALUES } from '@/lib/constants/board'
import {
  buildHref,
  firstValue,
  matchesQuery,
  parseOption,
  parseOptionalOption,
  parsePage,
  parseQuery,
} from '@/lib/utils/list-query'

const VIEWS = ['tile', 'detail', 'row'] as const

describe('firstValue', () => {
  it('should return the value when input is a string', () => {
    // Arrange & Act
    const result = firstValue('tile')

    // Assert
    expect(result).toBe('tile')
  })

  it('should return the first entry when input is an array', () => {
    // Arrange & Act
    const result = firstValue(['row', 'tile'])

    // Assert
    expect(result).toBe('row')
  })

  it('should return undefined when input is undefined', () => {
    // Arrange & Act
    const result = firstValue(undefined)

    // Assert
    expect(result).toBeUndefined()
  })
})

describe('parseOption', () => {
  it('should return the value when it is in the allow list', () => {
    // Arrange & Act
    const result = parseOption('row', VIEWS, 'tile')

    // Assert
    expect(result).toBe('row')
  })

  it('should return the fallback when the value is unknown', () => {
    // Arrange & Act
    const result = parseOption('galaxy', VIEWS, 'tile')

    // Assert
    expect(result).toBe('tile')
  })

  it('should return the fallback when the value is missing', () => {
    // Arrange & Act
    const result = parseOption(undefined, VIEWS, 'tile')

    // Assert
    expect(result).toBe('tile')
  })
})

describe('parseOptionalOption', () => {
  it('should return the value when it is in the allow list', () => {
    // Arrange & Act
    const result = parseOptionalOption('detail', VIEWS)

    // Assert
    expect(result).toBe('detail')
  })

  it('should return null when the value is unknown', () => {
    // Arrange & Act
    const result = parseOptionalOption('unknown', VIEWS)

    // Assert
    expect(result).toBeNull()
  })

  it('should accept every news category when parsed from the url', () => {
    // Arrange & Act — /news?category= 가 말머리 6종을 모두 받아야 칩이 동작한다.
    const parsed = NEWS_CATEGORY_VALUES.map((value) =>
      parseOptionalOption(value, NEWS_CATEGORY_VALUES),
    )

    // Assert
    expect(parsed).toEqual(['notice', 'maintenance', 'update', 'patch', 'event', 'info'])
  })

  it('should fall back to 전체 when the news category is unknown', () => {
    // Arrange & Act
    const result = parseOptionalOption('inspection', NEWS_CATEGORY_VALUES)

    // Assert — null 은 "전체" 칩이 활성이라는 뜻이다.
    expect(result).toBeNull()
  })
})

describe('parsePage', () => {
  it('should parse a numeric string when it is a positive integer', () => {
    // Arrange & Act
    const result = parsePage('3')

    // Assert
    expect(result).toBe(3)
  })

  it('should return 1 when the value is zero or negative', () => {
    // Arrange & Act
    const result = parsePage('-2')

    // Assert
    expect(result).toBe(1)
  })

  it('should return 1 when the value is not a number', () => {
    // Arrange & Act
    const result = parsePage('abc')

    // Assert
    expect(result).toBe(1)
  })

  it('should return 1 when the value is missing', () => {
    // Arrange & Act
    const result = parsePage(undefined)

    // Assert
    expect(result).toBe(1)
  })
})

describe('parseQuery', () => {
  it('should trim surrounding whitespace when a query is given', () => {
    // Arrange & Act
    const result = parseQuery('  서버 점검  ')

    // Assert
    expect(result).toBe('서버 점검')
  })

  it('should return an empty string when the query is missing', () => {
    // Arrange & Act
    const result = parseQuery(undefined)

    // Assert
    expect(result).toBe('')
  })
})

describe('buildHref', () => {
  it('should return the bare pathname when every value is empty', () => {
    // Arrange & Act
    const result = buildHref('/news', { category: null, q: '', view: undefined })

    // Assert
    expect(result).toBe('/news')
  })

  it('should keep only the filled values when some values are empty', () => {
    // Arrange & Act
    const result = buildHref('/news', { category: 'notice', q: '', view: 'row' })

    // Assert
    expect(result).toBe('/news?category=notice&view=row')
  })

  it('should omit page when page is 1', () => {
    // Arrange & Act
    const result = buildHref('/community', { page: 1 })

    // Assert
    expect(result).toBe('/community')
  })

  it('should keep page when page is greater than 1', () => {
    // Arrange & Act
    const result = buildHref('/community', { sort: 'views', page: 3 })

    // Assert
    expect(result).toBe('/community?sort=views&page=3')
  })

  it('should encode special characters when the query contains them', () => {
    // Arrange & Act
    const result = buildHref('/news', { q: '서버 점검' })

    // Assert
    expect(result).toBe('/news?q=%EC%84%9C%EB%B2%84+%EC%A0%90%EA%B2%80')
  })
})

describe('matchesQuery', () => {
  it('should return true when the query is empty', () => {
    // Arrange & Act
    const result = matchesQuery('', '서버 불안정 안내')

    // Assert
    expect(result).toBe(true)
  })

  it('should return true when any field contains the query', () => {
    // Arrange & Act
    const result = matchesQuery('점검', '홈페이지 오픈', '정기 점검 안내')

    // Assert
    expect(result).toBe(true)
  })

  it('should ignore case when comparing latin text', () => {
    // Arrange & Act
    const result = matchesQuery('PATCH', 'Patch note')

    // Assert
    expect(result).toBe(true)
  })

  it('should return false when no field contains the query', () => {
    // Arrange & Act
    const result = matchesQuery('이벤트', '서버 불안정 안내')

    // Assert
    expect(result).toBe(false)
  })
})
