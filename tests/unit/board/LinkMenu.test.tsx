import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { LinkMenu, type LinkMenuItem } from '@/components/board/LinkMenu'

import type { ComponentProps } from 'react'

const pushMock = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}))

/**
 * 실제 next/link 는 `AppRouterContext` 가 없으면(=테스트 환경) onClick 안에서
 * `if (!router) return` 으로 빠져 onNavigate 를 아예 호출하지 않는다. 여기서는
 * "수정 키 없는 클릭에서 onNavigate 가 불린다"는 실제 계약만 재현한 얇은 대역으로 바꾼다.
 */
vi.mock('next/link', () => {
  return {
    default: function LinkStub({
      href,
      onNavigate,
      children,
      ref,
      ...rest
    }: ComponentProps<'a'> & {
      href: string
      onNavigate?: (event: { preventDefault: () => void }) => void
    }) {
      return (
        <a
          href={href}
          ref={ref}
          onClick={(event) => {
            onNavigate?.({ preventDefault: () => event.preventDefault() })
          }}
          {...rest}
        >
          {children}
        </a>
      )
    },
  }
})

const items: readonly LinkMenuItem[] = [
  { label: '최신순', href: '/community', isActive: true },
  { label: '조회순', href: '/community?sort=views', isActive: false },
  { label: '인기순', href: '/community?sort=likes', isActive: false },
]

function renderMenu(menuItems: readonly LinkMenuItem[] = items) {
  render(<LinkMenu label="정렬 기준" trigger={<span>최신순</span>} items={menuItems} />)
  return screen.getByRole('button', { name: '정렬 기준' })
}

function openMenu() {
  const trigger = renderMenu()
  fireEvent.click(trigger)
  return trigger
}

describe('LinkMenu', () => {
  it('should expose listbox/option roles with the active option selected when opened', () => {
    // Arrange & Act
    openMenu()

    // Assert
    const options = screen.getAllByRole('option')
    expect(options).toHaveLength(3)
    expect(options[0]).toHaveAttribute('aria-selected', 'true')
    expect(options[1]).toHaveAttribute('aria-selected', 'false')
    expect(options[2]).toHaveAttribute('aria-selected', 'false')
  })

  it('should move DOM focus to the active option when the menu opens', () => {
    // Arrange & Act
    openMenu()

    // Assert
    expect(screen.getByRole('option', { name: '최신순' })).toHaveFocus()
  })

  it('should toggle aria-expanded and data-state on the trigger when opened', () => {
    // Arrange
    const trigger = renderMenu()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(trigger).toHaveAttribute('data-state', 'closed')

    // Act
    fireEvent.click(trigger)

    // Assert
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(trigger).toHaveAttribute('data-state', 'open')
  })

  it('should move focus forward with ArrowDown and wrap past the last option', () => {
    // Arrange
    openMenu()
    const listbox = screen.getByRole('listbox')

    // Act & Assert
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: '조회순' })).toHaveFocus()

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: '인기순' })).toHaveFocus()

    fireEvent.keyDown(listbox, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: '최신순' })).toHaveFocus()
  })

  it('should move focus backward with ArrowUp and wrap before the first option', () => {
    // Arrange
    openMenu()
    const listbox = screen.getByRole('listbox')

    // Act
    fireEvent.keyDown(listbox, { key: 'ArrowUp' })

    // Assert
    expect(screen.getByRole('option', { name: '인기순' })).toHaveFocus()
  })

  it('should jump to the first/last option with Home/End', () => {
    // Arrange
    openMenu()
    const listbox = screen.getByRole('listbox')

    // Act & Assert
    fireEvent.keyDown(listbox, { key: 'End' })
    expect(screen.getByRole('option', { name: '인기순' })).toHaveFocus()

    fireEvent.keyDown(listbox, { key: 'Home' })
    expect(screen.getByRole('option', { name: '최신순' })).toHaveFocus()
  })

  it('should navigate and close the menu when Space is pressed on the focused option', () => {
    // Arrange
    openMenu()
    const listbox = screen.getByRole('listbox')
    fireEvent.keyDown(listbox, { key: 'ArrowDown' })

    // Act
    fireEvent.keyDown(listbox, { key: ' ' })

    // Assert
    expect(pushMock).toHaveBeenCalledWith('/community?sort=views')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('should navigate and close the menu immediately when an option is clicked', () => {
    // Arrange
    openMenu()

    // Act
    fireEvent.click(screen.getByRole('option', { name: '인기순' }))

    // Assert
    expect(pushMock).toHaveBeenCalledWith('/community?sort=likes')
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('should close the menu and return focus to the trigger on Escape', () => {
    // Arrange
    const trigger = openMenu()

    // Act
    fireEvent.keyDown(document, { key: 'Escape' })

    // Assert
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('should close the menu when clicking outside without moving focus back', () => {
    // Arrange
    openMenu()

    // Act
    fireEvent.mouseDown(document.body)

    // Assert
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})
