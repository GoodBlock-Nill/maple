import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
}))

/**
 * `FEATURES.aboutDisabled` 는 모듈 로드 시점에 읽히므로, 값을 바꿔 가며
 * 검증하려면 env 설정 → `vi.resetModules()` → 재 import 순서를 지켜야 한다
 * (`tests/unit/constants/features.test.ts` 와 동일한 패턴).
 */
const ENV_KEY = 'NEXT_PUBLIC_FEATURE_ABOUT_DISABLED'
const ORIGINAL_ENV = process.env[ENV_KEY]

async function importSiteNavWithEnv(value: string | undefined) {
  vi.resetModules()

  if (value === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = value
  }

  return import('@/components/layout/SiteNav')
}

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = ORIGINAL_ENV
  }
})

describe('SiteNav — 소개 숨김(기본값)', () => {
  it('should not render 소개 at all', async () => {
    // Arrange
    const { SiteNav } = await importSiteNavWithEnv(undefined)

    // Act
    render(<SiteNav />)

    // Assert — 자리표시(회색 비활성)가 아니라 항목 자체가 없어야 한다.
    expect(screen.queryByText('소개')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '소개' })).not.toBeInTheDocument()
  })

  it('should keep every other menu item as a clickable link', async () => {
    // Arrange
    const { SiteNav } = await importSiteNavWithEnv(undefined)

    // Act
    render(<SiteNav />)

    // Assert
    expect(screen.getByRole('link', { name: '뉴스' })).toHaveAttribute('href', '/news')
    expect(screen.getByRole('link', { name: '커뮤니티' })).toHaveAttribute('href', '/community')
    expect(screen.getByRole('link', { name: '가이드' })).toHaveAttribute('href', '/guide')
    expect(screen.getByRole('link', { name: '랭킹' })).toHaveAttribute('href', '/ranking')
    expect(screen.getByRole('link', { name: '고객지원' })).toHaveAttribute('href', '/support')
  })
})

describe('SiteNav — 소개 다시 표시(env=false)', () => {
  it('should render 소개 as a normal link again', async () => {
    // Arrange
    const { SiteNav } = await importSiteNavWithEnv('false')

    // Act
    render(<SiteNav />)

    // Assert
    expect(screen.getByRole('link', { name: '소개' })).toHaveAttribute('href', '/about')
  })
})
