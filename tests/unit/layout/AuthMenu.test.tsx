import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 오므로 jsdom 에서 그대로
   import 할 수 없다. 이 테스트의 관심사는 마크업이라 비워 둔다. */
vi.mock('@/lib/actions/auth-actions', () => ({ signOut: async () => undefined }))

const { AuthMenu } = await import('@/components/layout/AuthMenu')

describe('AuthMenu (logged out)', () => {
  it('should show both the login and the signup pill', () => {
    // Arrange & Act — 이메일 가입이 되살아나 두 동작이 서로 다른 화면이 되었다.
    render(<AuthMenu />)

    // Assert
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login')
    expect(screen.getByRole('link', { name: '회원가입' })).toHaveAttribute('href', '/signup')
  })

  it('should not leak account controls', () => {
    // Arrange & Act
    render(<AuthMenu />)

    // Assert
    expect(screen.queryByText('내 정보')).not.toBeInTheDocument()
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument()
  })
})

describe('AuthMenu (logged in)', () => {
  it('should replace the pills with the nickname menu', () => {
    // Arrange & Act
    render(<AuthMenu user={{ nickname: '모험가' }} />)

    // Assert
    expect(screen.queryByRole('link', { name: '회원가입' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /모험가/ })).toBeInTheDocument()
  })

  it('should send a withdrawn account to the restore screen instead', () => {
    // Arrange & Act
    render(<AuthMenu user={{ nickname: '모험가', isWithdrawn: true }} />)

    // Assert
    expect(screen.getByRole('link', { name: '계정 복구' })).toHaveAttribute('href', '/auth/restore')
    expect(screen.queryByRole('link', { name: '회원가입' })).not.toBeInTheDocument()
  })
})
