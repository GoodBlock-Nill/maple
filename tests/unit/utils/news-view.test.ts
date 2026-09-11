import { describe, expect, it } from 'vitest'

import { DEFAULT_NEWS_VIEW, NEWS_VIEWS, NEWS_VIEW_VALUES } from '@/lib/constants/board'
import { buildHref } from '@/lib/utils/list-query'
import { newsViewParam, parseNewsView } from '@/lib/utils/news-view'

import type { NewsView } from '@/types/domain'

const NEWS_PATH = '/news'

/** 페이지가 링크를 만드는 방식 그대로(카테고리·검색·페이지 + 정규화된 view). */
function newsHref(view: NewsView, page = 1): string {
  return buildHref(NEWS_PATH, { category: 'notice', q: '점검', page, view: newsViewParam(view) })
}

describe('NEWS_VIEWS', () => {
  it('should list 가로형 before 카드형 when rendered as menu items', () => {
    // Arrange & Act
    const entries = NEWS_VIEWS.map((option) => [option.value, option.label])

    // Assert — 배열 순서가 곧 드롭다운 순서다(시안 v2 §1).
    expect(entries).toEqual([
      ['list', '가로형'],
      ['card', '카드형'],
    ])
  })

  it('should default to the card view when nothing is chosen', () => {
    // Arrange & Act & Assert
    expect(DEFAULT_NEWS_VIEW).toBe('card')
    expect(NEWS_VIEW_VALUES).toEqual(['list', 'card'])
  })
})

describe('parseNewsView', () => {
  it('should return the card view when the param is missing', () => {
    // Arrange & Act
    const result = parseNewsView(undefined)

    // Assert
    expect(result).toBe('card')
  })

  it('should return the list view when the param asks for it', () => {
    // Arrange & Act
    const result = parseNewsView('list')

    // Assert
    expect(result).toBe('list')
  })

  it('should fall back to the card view when the param is not an allowed value', () => {
    // Arrange & Act — 잘못된 URL 도 404 대신 기본 화면으로 떨어뜨린다.
    const result = parseNewsView('galaxy')

    // Assert
    expect(result).toBe('card')
  })

  it('should use the first entry when the param is repeated', () => {
    // Arrange & Act
    const result = parseNewsView(['list', 'card'])

    // Assert
    expect(result).toBe('list')
  })
})

describe('newsViewParam', () => {
  it('should drop the default view so links stay clean', () => {
    // Arrange & Act
    const result = newsViewParam('card')

    // Assert
    expect(result).toBeNull()
  })

  it('should keep the non-default view so links carry it', () => {
    // Arrange & Act
    const result = newsViewParam('list')

    // Assert
    expect(result).toBe('list')
  })
})

describe('news list hrefs', () => {
  it('should omit the view param when the card view is active', () => {
    // Arrange & Act
    const href = newsHref('card')

    // Assert
    expect(href).toBe('/news?category=notice&q=%EC%A0%90%EA%B2%80')
  })

  it('should carry the list view through filters and paging', () => {
    // Arrange & Act
    const href = newsHref('list', 2)

    // Assert
    expect(href).toBe('/news?category=notice&q=%EC%A0%90%EA%B2%80&page=2&view=list')
  })

  it('should keep only the view param when no filter is set', () => {
    // Arrange & Act
    const href = buildHref(NEWS_PATH, { category: null, q: '', view: newsViewParam('list') })

    // Assert
    expect(href).toBe('/news?view=list')
  })

  it('should return the bare path when the default view has no filters', () => {
    // Arrange & Act
    const href = buildHref(NEWS_PATH, { category: null, q: '', view: newsViewParam('card') })

    // Assert
    expect(href).toBe('/news')
  })
})
