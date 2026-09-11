import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { NewsViewMenu } from '@/components/board/NewsViewMenu'

import type { NewsView } from '@/types/domain'

const HREFS: Record<NewsView, string> = { card: '/news', list: '/news?view=list' }

function openMenu() {
  fireEvent.click(screen.getByRole('button', { name: /목록 보기 방식/ }))
}

describe('NewsViewMenu', () => {
  it('should label the trigger with the current view when rendered', () => {
    // Arrange & Act
    render(<NewsViewMenu current="card" hrefs={HREFS} />)

    // Assert
    expect(screen.getByRole('button', { name: '목록 보기 방식: 카드형' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    )
  })

  it('should offer both views as links when opened', () => {
    // Arrange
    render(<NewsViewMenu current="card" hrefs={HREFS} />)

    // Act
    openMenu()

    // Assert — 항목은 실제 링크라 서버가 그린 목록과 상태가 어긋날 수 없다.
    expect(screen.getByRole('menuitemradio', { name: '리스트형' })).toHaveAttribute(
      'href',
      '/news?view=list',
    )
    expect(screen.getByRole('menuitemradio', { name: '카드형' })).toHaveAttribute('href', '/news')
  })

  it('should mark only the current view as checked when opened', () => {
    // Arrange
    render(<NewsViewMenu current="list" hrefs={HREFS} />)

    // Act
    openMenu()

    // Assert
    expect(screen.getByRole('menuitemradio', { name: '리스트형' })).toHaveAttribute(
      'aria-checked',
      'true',
    )
    expect(screen.getByRole('menuitemradio', { name: '카드형' })).toHaveAttribute(
      'aria-checked',
      'false',
    )
  })

  it('should move focus to the first item when opened', () => {
    // Arrange
    render(<NewsViewMenu current="card" hrefs={HREFS} />)

    // Act
    openMenu()

    // Assert
    expect(screen.getByRole('menuitemradio', { name: '리스트형' })).toHaveFocus()
  })

  it('should close and restore focus when Escape is pressed', () => {
    // Arrange
    render(<NewsViewMenu current="card" hrefs={HREFS} />)
    openMenu()

    // Act
    fireEvent.keyDown(document, { key: 'Escape' })

    // Assert
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /목록 보기 방식/ })).toHaveFocus()
  })

  it('should close when a pointer press lands outside the menu', () => {
    // Arrange
    render(<NewsViewMenu current="card" hrefs={HREFS} />)
    openMenu()

    // Act
    fireEvent.pointerDown(document.body)

    // Assert
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })
})
