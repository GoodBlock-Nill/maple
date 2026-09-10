import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 오므로 jsdom 에서 그대로
   import 할 수 없다. 이 테스트의 관심사는 마크업이라 비워 둔다. */
vi.mock('@/lib/actions/auth-actions', () => ({ signOut: async () => undefined }))

const { MyPageSidebar } = await import('@/components/account/MyPageSidebar')
const { isMyPageTabActive, MYPAGE_TABS } = await import('@/components/account/mypage-tabs')

/**
 * 사이드바 — 활성 탭 판정과 사용자 행.
 *
 * `/account` 는 다른 두 경로의 접두사라 접두사 비교로 판정하면 쿠폰·문의내역에서도
 * "계정 관리"가 함께 켜진다. 그 함정을 테스트로 못 박는다.
 */

describe('isMyPageTabActive', () => {
  it('should light 계정 관리 only on its exact path', () => {
    // Arrange & Act & Assert
    expect(isMyPageTabActive('/account', '/account')).toBe(true)
    expect(isMyPageTabActive('/account/coupon', '/account')).toBe(false)
    expect(isMyPageTabActive('/account/inquiries', '/account')).toBe(false)
  })

  it('should light the other tabs on their own path and children', () => {
    // Arrange & Act & Assert
    expect(isMyPageTabActive('/account/coupon', '/account/coupon')).toBe(true)
    expect(isMyPageTabActive('/account/inquiries/abc', '/account/inquiries')).toBe(true)
    expect(isMyPageTabActive('/account', '/account/coupon')).toBe(false)
  })
})

describe('MyPageSidebar', () => {
  it('should render the three tabs in 시안 order', () => {
    // Arrange & Act
    render(<MyPageSidebar activeHref="/account" nickname="모험가" avatarUrl={null} />)

    // Assert
    const links = screen.getAllByRole('link')
    expect(links.map((link) => link.textContent)).toEqual(
      MYPAGE_TABS.map((tab) => tab.label) as string[],
    )
  })

  it('should mark exactly one tab as the current page', () => {
    // Arrange & Act
    render(<MyPageSidebar activeHref="/account/coupon" nickname="모험가" avatarUrl={null} />)

    // Assert
    const current = screen.getAllByRole('link').filter((link) => link.ariaCurrent === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('쿠폰')
  })

  it('should show the nickname and a logout control', () => {
    // Arrange & Act
    render(<MyPageSidebar activeHref="/account" nickname="모험가" avatarUrl={null} />)

    // Assert
    expect(screen.getByText('모험가')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
  })

  it('should fall back to the 시안 placeholder avatar', () => {
    // Arrange & Act
    const { container } = render(
      <MyPageSidebar activeHref="/account" nickname="모험가" avatarUrl={null} />,
    )

    // Assert
    expect(container.querySelector('img')).toHaveAttribute(
      'src',
      '/images/mypage/avatar-placeholder.png',
    )
  })

  it('should prefer the profile photo when there is one', () => {
    // Arrange & Act
    const { container } = render(
      <MyPageSidebar
        activeHref="/account"
        nickname="모험가"
        avatarUrl="https://cdn.example/avatar.png"
      />,
    )

    // Assert
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/avatar.png')
  })
})
