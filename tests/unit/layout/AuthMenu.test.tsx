import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 오므로 jsdom 에서 그대로
   import 할 수 없다. 이 테스트의 관심사는 마크업이라 비워 둔다. */
vi.mock('@/lib/actions/auth-actions', () => ({ signOut: async () => undefined }))

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

const { AuthMenu } = await import('@/components/layout/AuthMenu')

describe('AuthMenu (logged out)', () => {
  it('should show a single login pill', () => {
    // Arrange & Act — 로그인 수단이 간편로그인뿐이라 가입 버튼이 없다(시안 auth-v2).
    render(<AuthMenu />)

    // Assert
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('should not offer a separate signup screen', () => {
    // Arrange & Act
    render(<AuthMenu />)

    // Assert — 회원가입 경로는 사라졌다(프록시가 /login 으로 302).
    expect(screen.queryByRole('link', { name: '회원가입' })).not.toBeInTheDocument()
  })

  it('should not leak account controls', () => {
    // Arrange & Act
    render(<AuthMenu />)

    // Assert
    expect(screen.queryByText('마이페이지')).not.toBeInTheDocument()
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument()
  })
})

describe('AuthMenu (logged in)', () => {
  it('should replace the pill with a nickname trigger that opens a menu', async () => {
    // Arrange — 시안 v2 §1 의 계정 메뉴는 링크가 아니라 드롭다운 트리거다.
    const user = userEvent.setup()
    render(<AuthMenu user={{ nickname: '모험가', provider: 'google' }} />)
    const trigger = screen.getByRole('button', { name: /모험가/u })

    // Assert — 닫혀 있으면 항목이 아예 없다.
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()

    // Act
    await user.click(trigger)

    // Assert
    expect(trigger).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('menuitem', { name: '마이페이지' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('menuitem', { name: '로그아웃' })).toBeInTheDocument()
  })

  it('should move focus into the menu and close it on Escape', async () => {
    // Arrange
    const user = userEvent.setup()
    render(<AuthMenu user={{ nickname: '모험가' }} />)
    const trigger = screen.getByRole('button', { name: /모험가/u })

    // Act
    await user.click(trigger)

    // Assert — 열면 첫 항목으로 포커스가 들어간다.
    expect(screen.getByRole('menuitem', { name: '마이페이지' })).toHaveFocus()

    // Act
    await user.keyboard('{Escape}')

    // Assert — 닫고 트리거로 되돌린다.
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
    expect(trigger).toHaveFocus()
  })

  it('should close when something outside is clicked', async () => {
    // Arrange
    const user = userEvent.setup()
    render(
      <div>
        <button type="button">바깥</button>
        <AuthMenu user={{ nickname: '모험가' }} />
      </div>,
    )
    await user.click(screen.getByRole('button', { name: /모험가/u }))

    // Act
    await user.click(screen.getByRole('button', { name: '바깥' }))

    // Assert
    expect(screen.queryByRole('menu')).not.toBeInTheDocument()
  })

  it('should highlight 마이페이지 while the user is on an account page', async () => {
    // Arrange
    const user = userEvent.setup()
    pathname = '/account/link'
    render(<AuthMenu user={{ nickname: '모험가' }} />)

    // Act
    await user.click(screen.getByRole('button', { name: /모험가/u }))

    // Assert — 시안 색(#e8308a + bg #f6f7fa).
    const item = screen.getByRole('menuitem', { name: '마이페이지' })
    expect(item.className).toContain('text-[#e8308a]')
    expect(item.className).toContain('bg-[#f6f7fa]')
    pathname = '/'
  })

  it('should send a withdrawn account to the restore screen instead', () => {
    // Arrange & Act
    render(<AuthMenu user={{ nickname: '모험가', isWithdrawn: true }} />)

    // Assert
    expect(screen.getByRole('link', { name: '계정 복구' })).toHaveAttribute('href', '/auth/restore')
    expect(screen.queryByRole('button', { name: /모험가/u })).not.toBeInTheDocument()
  })
})
