import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'

let pathname = '/'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

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
  pathname = '/'
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
 * 비로그인 드로어(시안 v2 §비로그인) — 상단 바 아래 전체 폭 "로그인" 알약 하나뿐이고
 * 계정 행은 아예 없다.
 */
describe('MobileNav — 비로그인 상태', () => {
  it('should show a full-width 로그인 pill and no account row', async () => {
    // Arrange
    const { MobileNav } = await importMobileNavWithEnv(undefined)

    // Act
    render(<MobileNav />)

    // Assert
    expect(screen.getByRole('link', { name: '로그인' })).toHaveAttribute('href', '/login')
    expect(screen.queryByText('내 정보')).not.toBeInTheDocument()
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /계정/ })).not.toBeInTheDocument()
  })
})

/**
 * 로그인 상태 드로어(시안 v2 §로그인) — 계정 행은 기본적으로 접혀 있고, 눌러야
 * "내 정보 · 로그아웃"이 드러난다(데스크톱 드롭다운과 같은 두 항목).
 */
describe('MobileNav — 로그인 상태', () => {
  it('should keep 내 정보/로그아웃 hidden until the account row is opened', async () => {
    // Arrange
    const { MobileNav } = await importMobileNavWithEnv(undefined)

    // Act
    render(<MobileNav user={{ nickname: '모험가' }} />)

    // Assert — 접힌 상태에서는 하위 항목이 없다.
    expect(screen.queryByText('내 정보')).not.toBeInTheDocument()
    expect(screen.queryByText('로그아웃')).not.toBeInTheDocument()
    /* 로그인 버튼은 미로그인일 때만 둔다. */
    expect(screen.queryByRole('link', { name: '로그인' })).not.toBeInTheDocument()

    const accountRow = screen.getByRole('button', { name: /모험가/ })
    expect(accountRow).toHaveAttribute('aria-expanded', 'false')
  })

  it('should reveal 내 정보 and 로그아웃 after opening the account row', async () => {
    // Arrange
    const user = userEvent.setup()
    const { MobileNav } = await importMobileNavWithEnv(undefined)
    render(<MobileNav user={{ nickname: '모험가' }} />)

    // Act
    await user.click(screen.getByRole('button', { name: /모험가/ }))

    // Assert
    expect(screen.getByRole('link', { name: '내 정보' })).toHaveAttribute('href', '/account')
    expect(screen.getByRole('button', { name: '로그아웃' })).toBeInTheDocument()
  })

  it('should point a withdrawn account at the restore screen instead', async () => {
    // Arrange
    const user = userEvent.setup()
    const { MobileNav } = await importMobileNavWithEnv(undefined)
    render(<MobileNav user={{ nickname: '모험가', isWithdrawn: true }} />)

    // Act
    await user.click(screen.getByRole('button', { name: /모험가/ }))

    // Assert
    expect(screen.getByRole('link', { name: '계정 복구' })).toHaveAttribute('href', '/auth/restore')
    expect(screen.queryByRole('link', { name: '내 정보' })).not.toBeInTheDocument()
  })
})

/** GNB 활성 상태(시안 v2 §GNB 5행) — 현재 경로 행만 핑크로 강조한다. */
describe('MobileNav — GNB 활성 상태', () => {
  it('should highlight the current page row with the pink active style', async () => {
    // Arrange
    pathname = '/news'
    const { MobileNav } = await importMobileNavWithEnv(undefined)

    // Act
    render(<MobileNav />)

    // Assert
    const activeLink = screen.getByRole('link', { name: '뉴스' })
    expect(activeLink.className).toContain('bg-[#f6f7fa]')
    expect(activeLink.className).toContain('text-[#e8308a]')

    const inactiveLink = screen.getByRole('link', { name: '커뮤니티' })
    expect(inactiveLink.className).not.toContain('text-[#e8308a]')
  })
})

/** 하단 바로가기(시안 v2 §드로어 골격) — 메이플 월드/디스코드 링크가 하단에 고정된다. */
describe('MobileNav — 하단 바로가기', () => {
  it('should link to PLAY_URL and DISCORD_URL', async () => {
    // Arrange
    const { MobileNav } = await importMobileNavWithEnv(undefined)

    // Act
    render(<MobileNav />)

    // Assert
    expect(screen.getByRole('link', { name: /메이플 월드 바로가기/ })).toHaveAttribute(
      'href',
      '/play',
    )
    expect(screen.getByRole('link', { name: /디스코드 바로가기/ })).toHaveAttribute(
      'href',
      '/discord',
    )
  })
})
