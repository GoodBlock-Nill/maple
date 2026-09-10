import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NAV_ITEMS } from '@/lib/constants/site'

/**
 * `FEATURES.aboutDisabled` 는 모듈 로드 시점에 읽히므로, 값을 바꿔 가며
 * 검증하려면 env 설정 → `vi.resetModules()` → 재 import 순서를 지켜야 한다.
 *
 * `SiteFooter` 자체는 async 서버 컴포넌트라 `getSiteSettings()`(Supabase, server-only
 * 의존 체인)를 끌고 와서 jsdom 단위 테스트에서 그대로 import 할 수 없다 — 그래서
 * `FooterColumn` 을 별도 모듈(`components/layout/FooterColumn.tsx`)로 분리해 두고
 * 여기서는 그 컴포넌트만 렌더링해 검증한다.
 */
const ENV_KEY = 'NEXT_PUBLIC_FEATURE_ABOUT_DISABLED'
const ORIGINAL_ENV = process.env[ENV_KEY]

async function importFooterColumnWithEnv(value: string | undefined) {
  vi.resetModules()

  if (value === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = value
  }

  return import('@/components/layout/FooterColumn')
}

afterEach(() => {
  if (ORIGINAL_ENV === undefined) {
    delete process.env[ENV_KEY]
  } else {
    process.env[ENV_KEY] = ORIGINAL_ENV
  }
})

describe('FooterColumn — 소개 숨김(기본값)', () => {
  it('should not render 소개 at all', async () => {
    // Arrange
    const { FooterColumn } = await importFooterColumnWithEnv(undefined)

    // Act
    render(<FooterColumn title="Menu" links={NAV_ITEMS} />)

    // Assert — 자리표시(회색 비활성)가 아니라 항목 자체가 없어야 한다.
    expect(screen.queryByText('소개')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '소개' })).not.toBeInTheDocument()
  })

  it('should keep every other menu link clickable', async () => {
    // Arrange
    const { FooterColumn } = await importFooterColumnWithEnv(undefined)

    // Act
    render(<FooterColumn title="Menu" links={NAV_ITEMS} />)

    // Assert
    expect(screen.getByRole('link', { name: '뉴스' })).toHaveAttribute('href', '/news')
    expect(screen.getByRole('link', { name: '고객지원' })).toHaveAttribute('href', '/support')
  })
})

describe('FooterColumn — 소개 다시 표시(env=false)', () => {
  it('should render 소개 as a normal link again', async () => {
    // Arrange
    const { FooterColumn } = await importFooterColumnWithEnv('false')

    // Act
    render(<FooterColumn title="Menu" links={NAV_ITEMS} />)

    // Assert
    expect(screen.getByRole('link', { name: '소개' })).toHaveAttribute('href', '/about')
  })
})
