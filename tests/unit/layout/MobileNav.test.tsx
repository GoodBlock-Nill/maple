import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

/* 서버 액션 모듈은 supabase 서버 클라이언트를 끌고 오므로 jsdom 에서 그대로
   import 할 수 없다. 이 테스트의 관심사는 마크업이라 비워 둔다(AuthMenu.test.tsx 와 동일). */
vi.mock('@/lib/actions/auth-actions', () => ({ signOut: async () => undefined }))

const ENV_KEY = 'NEXT_PUBLIC_FEATURE_ABOUT_DISABLED'
const ORIGINAL_ENV = process.env[ENV_KEY]

async function importMobileNavWithEnv(value: string | undefined) {
  vi.resetModules()

  if (value === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = value
  }

  return import('@/components/layout/MobileNav')
}

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = ORIGINAL_ENV
  }
})

describe('MobileNav — 소개 숨김(기본값)', () => {
  it('should not render 소개 in the drawer at all', async () => {
    // Arrange — 드로어는 body 로 포털되어 열림 여부와 무관하게 마크업이 존재한다.
    const { MobileNav } = await importMobileNavWithEnv(undefined)

    // Act
    render(<MobileNav />)

    // Assert — 자리표시(회색 비활성)가 아니라 항목 자체가 없어야 한다.
    expect(screen.queryByText('소개')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '소개' })).not.toBeInTheDocument()
  })

  it('should keep every other drawer item as a clickable link', async () => {
    // Arrange
    const { MobileNav } = await importMobileNavWithEnv(undefined)

    // Act
    render(<MobileNav />)

    // Assert
    expect(screen.getByRole('link', { name: '뉴스' })).toHaveAttribute('href', '/news')
    expect(screen.getByRole('link', { name: '고객지원' })).toHaveAttribute('href', '/support')
  })
})

describe('MobileNav — 소개 다시 표시(env=false)', () => {
  it('should render 소개 as a normal link again', async () => {
    // Arrange
    const { MobileNav } = await importMobileNavWithEnv('false')

    // Act
    render(<MobileNav />)

    // Assert
    expect(screen.getByRole('link', { name: '소개' })).toHaveAttribute('href', '/about')
  })
})

/**
 * 로그인 상태 드로어(시안 v2 §1) — 폰에는 헤더 알약이 없고, "마이페이지 ·
 * 로그아웃"이 드로어 안에만 있다(데스크톱 드롭다운과 같은 두 항목).
 */
describe('MobileNav — 로그인 상태', () => {
  it('should offer 마이페이지 and 로그아웃 inside the drawer', async () => {
    // Arrange
    const { MobileNav } = await importMobileNavWithEnv(undefined)

    // Act
    render(<MobileNav user={{ nickname: '모험가' }} />)

    // Assert
    expect(screen.getByRole('link', { name: '마이페이지' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
    expect(screen.queryByText('내 정보')).not.toBeInTheDocument()
    /* 로그인 버튼은 미로그인일 때만 둔다. */
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument()
  })

  it('should point a withdrawn account at the restore screen instead', async () => {
    // Arrange
    const { MobileNav } = await importMobileNavWithEnv(undefined)

    // Act
    render(<MobileNav user={{ nickname: '모험가', isWithdrawn: true }} />)

    // Assert
    expect(screen.getByRole('link', { name: '계정 복구' })).toHaveAttribute('href', '/auth/restore')
    expect(screen.queryByRole('link', { name: '마이페이지' })).not.toBeInTheDocument()
  })
})
