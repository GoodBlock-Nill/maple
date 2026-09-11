import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NewsRow } from '@/components/board/NewsRow'

import type { NewsItem } from '@/types/domain'

/**
 * 리스트형 목록의 행(시안 v2 §5). 카드형과 같은 표면을 쓰지만 요약 줄이 없다 —
 * 고정 핀은 `isPinned` 인 글에만 그린다.
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

describe('NewsRow', () => {
  it('should link the whole row to the detail page when rendered', () => {
    // Arrange & Act
    render(<NewsRow item={newsItem()} />)

    // Assert
    expect(screen.getByRole('link', { name: /서버 불안정 안내/ })).toHaveAttribute(
      'href',
      '/news/11111111-0000-4000-8000-000000000001',
    )
  })

  it('should show the category badge and meta row when rendered', () => {
    // Arrange & Act
    render(<NewsRow item={newsItem()} />)

    // Assert
    expect(screen.getByText('공지사항')).toBeInTheDocument()
    expect(screen.getByText(/2026-01-11/)).toBeInTheDocument()
    expect(screen.getByText(/160745/)).toBeInTheDocument()
  })

  it('should show the pin icon when the news item is pinned', () => {
    // Arrange & Act
    render(<NewsRow item={newsItem({ isPinned: true })} />)

    // Assert
    expect(screen.getByAltText('고정된 글')).toBeInTheDocument()
  })

  it('should omit the pin icon when the news item is not pinned', () => {
    // Arrange & Act
    render(<NewsRow item={newsItem()} />)

    // Assert
    expect(screen.queryByAltText('고정된 글')).not.toBeInTheDocument()
  })

  it('should not render the summary even when the admin wrote one', () => {
    // Arrange & Act — 리스트형은 요약 없이 제목만 보인다(시안 v2 §5).
    render(<NewsRow item={newsItem({ summary: '점검 일정 안내' })} />)

    // Assert
    expect(screen.queryByText('점검 일정 안내')).not.toBeInTheDocument()
  })
})
