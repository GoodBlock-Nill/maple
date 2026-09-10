import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 오므로 jsdom 에서 그대로
   import 할 수 없다. 이 테스트의 관심사는 마크업이라 비워 둔다. */
vi.mock('@/lib/actions/auth-actions', () => ({ signOut: async () => undefined }))

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
    expect(screen.queryByText('내 정보')).not.toBeInTheDocument()
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument()
  })
})

describe('AuthMenu (logged in)', () => {
  it('should replace the pill with a link to 마이페이지', () => {
    // Arrange & Act — 시안(2041:3122)의 로그인 알약은 드롭다운이 아니라 링크다.
    render(<AuthMenu user={{ nickname: '모험가' }} />)

    // Assert
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: /모험가/ })).toHaveAttribute('href', '/account')
  })

  it('should send a withdrawn account to the restore screen instead', () => {
    // Arrange & Act
    render(<AuthMenu user={{ nickname: '모험가', isWithdrawn: true }} />)

    // Assert
    expect(screen.getByRole('link', { name: '계정 복구' })).toHaveAttribute('href', '/auth/restore')
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument()
  })
})
