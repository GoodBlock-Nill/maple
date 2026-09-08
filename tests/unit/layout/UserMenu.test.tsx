import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 오므로 jsdom 에서 그대로
   import 할 수 없다. 폼 액션 자체는 이 테스트의 관심사가 아니라서 비워 둔다. */
vi.mock('@/lib/actions/auth-actions', () => ({
  signOut: async () => undefined,
}))

const { UserMenu } = await import('@/components/layout/UserMenu')

describe('UserMenu', () => {
  it('should show the nickname and a first-letter avatar when no avatarUrl is given', () => {
    // Arrange & Act
    render(<UserMenu nickname="모험가" />)

    // Assert — 로그아웃 텍스트가 트리거에 그대로 노출되면 안 된다(제품 결정 2026-09-08).
    expect(screen.getByRole('button', { name: /모험가/ })).toBeInTheDocument()
    expect(screen.getByText('모')).toBeInTheDocument()
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument()
  })

  it('should open a menu with 내 정보 and 로그아웃 when the trigger is clicked', () => {
    // Arrange
    render(<UserMenu nickname="모험가" />)
    const trigger = screen.getByRole('button', { name: /모험가/ })

    // Act
    fireEvent.click(trigger)

    // Assert
    expect(screen.getByRole('menu')).toBeInTheDocument()
    expect(screen.getByRole('menuitem', { name: '내 정보' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('menuitem', { name: '로그아웃' })).toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
  })

  it('should close on Escape and return focus to the trigger', () => {
    // Arrange
    render(<UserMenu nickname="모험가" />)
    const trigger = screen.getByRole('button', { name: /모험가/ })
    fireEvent.click(trigger)

    // Act
    fireEvent.keyDown(document, { key: 'Escape' })

    // Assert
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('should close when clicking outside the menu', () => {
    // Arrange
    render(
      <div>
        <UserMenu nickname="모험가" />
        <button type="button">바깥</button>
      </div>,
    )
    fireEvent.click(screen.getByRole('button', { name: /모험가/ }))
    expect(screen.getByRole('menu')).toBeInTheDocument()

    // Act
    fireEvent.mouseDown(screen.getByRole('button', { name: '바깥' }))

    // Assert
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('should submit the sign-out form when 로그아웃 is activated', () => {
    // Arrange
    const { container } = render(<UserMenu nickname="모험가" />)
    fireEvent.click(screen.getByRole('button', { name: /모험가/ }))

    // Assert — 로그아웃은 링크가 아니라 폼(POST) 이어야 한다(CSRF).
    const form = container.querySelector('form')
    expect(form).not.toBeNull()
    expect(form?.querySelector('button[type="submit"]')?.textContent).toBe('로그아웃')
  })
})
