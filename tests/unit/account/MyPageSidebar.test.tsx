import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * 사이드바(시안 v2 §2) — 탭 2개, 활성 판정, "준비중" 배지.
 *
 * `/account` 는 `/account/link` 의 접두사라 접두사 비교로 판정하면 계정 연동에서도
 * "계정 관리"가 함께 켜진다. 그 함정을 테스트로 못 박는다.
 *
 * 배지는 `FEATURES.mswAccountFields` 를 모듈 로드 시점에 읽으므로, 값을 바꿔 가며
 * 검증하려면 env 설정 → `vi.resetModules()` → 재 import 순서를 지켜야 한다.
 */
const ENV_KEY = 'NEXT_PUBLIC_FEATURE_MSW_ACCOUNT_FIELDS'
const ORIGINAL_ENV = process.env[ENV_KEY]

async function importSidebarWithFlag(value: string | undefined) {
  vi.resetModules()

  if (value === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = value
  }

  return {
    ...(await import('@/components/account/MyPageSidebar')),
    ...(await import('@/components/account/mypage-tabs')),
  }
}

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = ORIGINAL_ENV
  }
})

const { isMyPageTabActive } = await import('@/components/account/mypage-tabs')

describe('isMyPageTabActive', () => {
  it('should light 계정 관리 only on its exact path', () => {
    // Arrange & Act & Assert
    expect(isMyPageTabActive('/account', '/account')).toBe(true)
    expect(isMyPageTabActive('/account/link', '/account')).toBe(false)
  })

  it('should light 계정 연동 on its own path and children', () => {
    // Arrange & Act & Assert
    expect(isMyPageTabActive('/account/link', '/account/link')).toBe(true)
    expect(isMyPageTabActive('/account/link/step2', '/account/link')).toBe(true)
    expect(isMyPageTabActive('/account', '/account/link')).toBe(false)
  })
})

describe('MyPageSidebar', () => {
  it('should render exactly the two 시안 tabs in order', async () => {
    // Arrange
    const { MyPageSidebar } = await importSidebarWithFlag(undefined)

    // Act
    render(<MyPageSidebar activeHref="/account" />)

    // Assert — 쿠폰·문의내역 탭은 v2 에서 사라졌다.
    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveAttribute('href', '/account')
    expect(links[1]).toHaveAttribute('href', '/account/link')
    expect(screen.queryByRole('link', { name: /쿠폰/u })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: /문의내역/u })).not.toBeInTheDocument()
  })

  it('should mark exactly one tab as the current page', async () => {
    // Arrange
    const { MyPageSidebar } = await importSidebarWithFlag(undefined)

    // Act
    render(<MyPageSidebar activeHref="/account/link" />)

    // Assert
    const current = screen.getAllByRole('link').filter((link) => link.ariaCurrent === 'page')
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('계정 연동')
  })

  it('should badge 계정 연동 as 준비중 while the world-account flag is off', async () => {
    // Arrange
    const { MyPageSidebar } = await importSidebarWithFlag(undefined)

    // Act
    render(<MyPageSidebar activeHref="/account" />)

    // Assert
    expect(screen.getByText('준비중')).toBeInTheDocument()
  })

  it('should drop the badge once the flag is on', async () => {
    // Arrange
    const { MyPageSidebar } = await importSidebarWithFlag('true')

    // Act
    render(<MyPageSidebar activeHref="/account" />)

    // Assert
    expect(screen.queryByText('준비중')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: '계정 연동' })).toBeInTheDocument()
  })

  it('should not carry a user row anymore', async () => {
    // Arrange — 로그아웃은 헤더 드롭다운 한 곳뿐이다(시안 v2 §1·§2).
    const { MyPageSidebar } = await importSidebarWithFlag(undefined)

    // Act
    const { container } = render(<MyPageSidebar activeHref="/account" />)

    // Assert
    expect(screen.queryByRole('button', { name: '로그아웃' })).not.toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
  })
})
