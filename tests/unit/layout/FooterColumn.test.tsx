import { render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { FOOTER_POLICY_LINKS, NAV_ITEMS, POLICY_LINKS } from '@/lib/constants/site'

/**
 * `FEATURES.aboutDisabled` 는 모듈 로드 시점에 읽히므로, 값을 바꿔 가며
 * 검증하려면 env 설정 → `vi.resetModules()` → 재 import 순서를 지켜야 한다.
 *
 * `SiteFooter` 자체는 async 서버 컴포넌트라 `getSiteSettings()`(Supabase, server-only
 * 의존 체인)를 끌고 와서 jsdom 단위 테스트에서 그대로 import 할 수 없다 — 그래서
 * `FooterColumn` 을 별도 모듈(`components/layout/FooterColumn.tsx`)로 분리해 두고
 * 여기서는 그 컴포넌트만 렌더링해 검증한다.
 */
const ENV_KEYS = [
  'NEXT_PUBLIC_FEATURE_ABOUT_DISABLED',
  'NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON',
  'NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON',
] as const

type EnvKey = (typeof ENV_KEYS)[number]

const ENV_KEY: EnvKey = 'NEXT_PUBLIC_FEATURE_ABOUT_DISABLED'

const ORIGINAL_ENV: Record<EnvKey, string | undefined> = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]]),
) as Record<EnvKey, string | undefined>

async function importFooterColumnWithEnv(
  value: string | undefined,
  overrides: Partial<Record<EnvKey, string>> = {},
) {
  vi.resetModules()

  for (const key of ENV_KEYS) {
    const next = key === ENV_KEY ? value : overrides[key]

    if (next === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = next
    }
  }

  return import('@/components/layout/FooterColumn')
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    const original = ORIGINAL_ENV[key]

    if (original === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = original
    }
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

/**
 * 시안 v2 §5 — 푸터 Menu 열은 준비 중(가이드·랭킹)도 제외한다. 헤더 GNB 는
 * 그대로 보여 주므로(눌러 들어가면 "준비 중" 카드가 뜬다) 이 필터는 푸터만의
 * 규칙이다.
 */
describe('FooterColumn — 준비 중 메뉴', () => {
  it('should keep 가이드·랭킹 while their coming-soon flags are off', async () => {
    // Arrange
    const { FooterColumn } = await importFooterColumnWithEnv(undefined)

    // Act
    render(<FooterColumn title="Menu" links={NAV_ITEMS} />)

    // Assert
    expect(screen.getByRole('link', { name: '가이드' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '랭킹' })).toBeInTheDocument()
  })

  it('should drop each page as soon as its coming-soon flag is on', async () => {
    // Arrange
    const { FooterColumn } = await importFooterColumnWithEnv(undefined, {
      NEXT_PUBLIC_FEATURE_GUIDE_COMING_SOON: 'true',
      NEXT_PUBLIC_FEATURE_RANKING_COMING_SOON: 'true',
    })

    // Act
    render(<FooterColumn title="Menu" links={NAV_ITEMS} />)

    // Assert — 시안 v2 의 Menu 열: 뉴스 · 커뮤니티 · 고객지원.
    expect(screen.getAllByRole('link').map((link) => link.textContent)).toEqual([
      '뉴스',
      '커뮤니티',
      '고객지원',
    ])
  })
})

describe('FOOTER_POLICY_LINKS', () => {
  it('should list the three 시안 documents without 마케팅', () => {
    // Arrange & Act & Assert — 마케팅 문안은 동의 흐름 안에서만 읽는다(시안 v2 §5).
    expect(FOOTER_POLICY_LINKS.map((link) => link.label)).toEqual([
      '개인정보처리방침',
      '디스코드 운영정책',
      '글자월드 운영정책',
    ])
    expect(POLICY_LINKS.some((link) => link.href === '/policy/marketing')).toBe(true)
  })
})
