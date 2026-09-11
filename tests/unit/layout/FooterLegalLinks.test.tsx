import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { FooterLegalLinks } from '@/components/layout/FooterLegalLinks'
import { FOOTER_POLICY_LINKS } from '@/lib/constants/site'

describe('FooterLegalLinks', () => {
  it('should render every link with its href', () => {
    // Arrange & Act
    render(<FooterLegalLinks links={FOOTER_POLICY_LINKS} />)

    // Assert — 시안 v3 §5: 개인정보처리방침 · 디스코드 운영정책 · 글자월드 운영정책.
    expect(screen.getByRole('link', { name: '개인정보처리방침' })).toHaveAttribute(
      'href',
      '/policy/privacy',
    )
    expect(screen.getByRole('link', { name: '디스코드 운영정책' })).toHaveAttribute(
      'href',
      '/policy/discord',
    )
    expect(screen.getByRole('link', { name: '글자월드 운영정책' })).toHaveAttribute(
      'href',
      '/policy/operating',
    )
  })

  it('should place one separator between each pair of links, none before the first', () => {
    // Arrange & Act
    const { container } = render(<FooterLegalLinks links={FOOTER_POLICY_LINKS} />)

    // Assert — 링크 3개면 구분선은 2개(링크 사이에만).
    const separators = container.querySelectorAll('[aria-hidden="true"]')
    expect(separators).toHaveLength(FOOTER_POLICY_LINKS.length - 1)
  })

  it('should render nothing but an empty list when given no links', () => {
    // Arrange & Act
    render(<FooterLegalLinks links={[]} />)

    // Assert
    expect(screen.queryAllByRole('link')).toHaveLength(0)
  })
})
