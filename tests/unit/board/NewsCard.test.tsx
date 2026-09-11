import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NewsCard } from '@/components/board/NewsCard'

import type { NewsItem } from '@/types/domain'

/**
 * 카드형 목록의 카드(시안 v2 §2). 고정 핀은 `isPinned` 인 글에만, 요약 줄은 값이
 * 있을 때만 그린다 — 빈 요약에 빈 줄을 남기면 카드마다 본문 위치가 흔들린다.
 */

function newsItem(overrides: Partial<NewsItem> = {}): NewsItem {
  return {
    id: '11111111-0000-4000-8000-000000000001',
    category: 'notice',
    title: '서버 불안정 안내',
    summary: '안녕하세요, 메이플스타 모험가 여러분.',
    body: '# 본문',
    contentFormat: 'markdown',
    views: 160745,
    publishedAt: '2026-01-11T10:00:00.000Z',
    editedAt: null,
    isPinned: false,
    ...overrides,
  }
}

describe('NewsCard', () => {
  it('should link the whole card to the detail page when rendered', () => {
    // Arrange & Act
    render(<NewsCard item={newsItem()} />)

    // Assert
    expect(screen.getByRole('link', { name: /서버 불안정 안내/ })).toHaveAttribute(
      'href',
      '/news/11111111-0000-4000-8000-000000000001',
    )
  })

  it('should show the category badge and meta row when rendered', () => {
    // Arrange & Act
    render(<NewsCard item={newsItem()} />)

    // Assert
    expect(screen.getByText('공지사항')).toBeInTheDocument()
    expect(screen.getByText(/2026-01-11/)).toBeInTheDocument()
    expect(screen.getByText(/160745/)).toBeInTheDocument()
  })

  it('should show the pin icon when the news item is pinned', () => {
    // Arrange & Act
    render(<NewsCard item={newsItem({ isPinned: true })} />)

    // Assert
    expect(screen.getByAltText('고정된 글')).toBeInTheDocument()
  })

  it('should omit the pin icon when the news item is not pinned', () => {
    // Arrange & Act
    render(<NewsCard item={newsItem()} />)

    // Assert
    expect(screen.queryByAltText('고정된 글')).not.toBeInTheDocument()
  })

  it('should render the summary when the admin wrote one', () => {
    // Arrange & Act
    render(<NewsCard item={newsItem({ summary: '점검 일정 안내' })} />)

    // Assert
    expect(screen.getByText('점검 일정 안내')).toBeInTheDocument()
  })

  it('should omit the summary line when the summary is empty', () => {
    // Arrange
    const { container } = render(<NewsCard item={newsItem({ summary: '' })} />)

    // Act — 카드 본문에 남는 문단은 요약뿐이라, 없으면 <p> 가 하나도 없어야 한다.
    const paragraphs = container.querySelectorAll('div > p')

    // Assert
    expect(paragraphs).toHaveLength(0)
  })
})
