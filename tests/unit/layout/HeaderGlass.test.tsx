import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HeaderGlass } from '@/components/layout/HeaderGlass'

function setScrollY(value: number) {
  Object.defineProperty(window, 'scrollY', { value, writable: true, configurable: true })
}

describe('HeaderGlass', () => {
  beforeEach(() => {
    setScrollY(0)
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 0
    })
    vi.stubGlobal('cancelAnimationFrame', () => {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('should render only the base glass class when scrollY is 0', () => {
    // Arrange & Act
    render(
      <HeaderGlass className="rounded-bar">
        <span>content</span>
      </HeaderGlass>,
    )

    // Assert - scrollY 0 시안과 픽셀 동일해야 하므로 scrolled 변형이 섞이면 안 된다.
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('glass')
    expect(header).not.toHaveClass('glass-scrolled')
  })

  it('should add the glass-scrolled class after scrolling past the threshold', () => {
    // Arrange
    setScrollY(100)

    // Act
    render(
      <HeaderGlass className="rounded-bar">
        <span>content</span>
      </HeaderGlass>,
    )

    // Assert
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('glass', 'glass-scrolled')
  })

  it('should keep the layout classes passed via className unchanged in both states', () => {
    // Arrange & Act
    render(
      <HeaderGlass className="rounded-bar px-5 py-[15px]">
        <span>content</span>
      </HeaderGlass>,
    )

    // Assert - 높이/패딩/라운드는 스크롤 상태와 무관하게 유지되어야 한다.
    const header = screen.getByRole('banner')
    expect(header).toHaveClass('rounded-bar', 'px-5', 'py-[15px]')
  })
})
