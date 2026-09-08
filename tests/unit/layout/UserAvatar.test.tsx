import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { UserAvatar } from '@/components/layout/UserAvatar'

/**
 * 제공자 → 브랜드 마크 매핑, 사진 있음/없음 분기, 폴백(첫 글자) 분기를 검증한다.
 * 마크는 인라인 SVG 라 텍스트로 조회할 수 없으므로 `container.querySelector('svg')`
 * 존재 여부 + 문자 폴백 부재로 "글자가 아니라 마크가 그려졌는지"를 확인한다.
 */
describe('UserAvatar', () => {
  it('should fall back to the first letter of the nickname when no provider is known', () => {
    // Arrange & Act
    render(<UserAvatar nickname="모험가" size="sm" />)

    // Assert
    expect(screen.getByText('모')).toBeInTheDocument()
  })

  it.each([
    ['google', '구'],
    ['kakao', '카'],
    ['naver', '네'],
  ] as const)(
    'should render the %s brand mark instead of the "%s" initial letter',
    (provider, initial) => {
      // Arrange & Act
      const { container } = render(
        <UserAvatar nickname={`${initial}험가`} provider={provider} size="sm" />,
      )

      // Assert — 더 이상 글자 폴백이 아니라 SVG 마크가 그려져야 한다.
      expect(container.querySelector('svg')).toBeInTheDocument()
      expect(screen.queryByText(initial)).not.toBeInTheDocument()
    },
  )

  it('should show a photo without a provider badge when the provider is unknown', () => {
    // Arrange & Act
    const { container } = render(
      <UserAvatar nickname="모험가" avatarUrl="https://example.com/a.png" size="sm" />,
    )

    // Assert
    expect(container.querySelector('img')).toHaveAttribute('src', 'https://example.com/a.png')
    expect(container.querySelector('svg')).not.toBeInTheDocument()
  })

  it('should overlay the provider mark as a badge when a photo is present', () => {
    // Arrange & Act
    const { container } = render(
      <UserAvatar
        nickname="모험가"
        avatarUrl="https://example.com/a.png"
        provider="kakao"
        size="sm"
      />,
    )

    // Assert — 사진은 그대로, 마크는 배지(장식)로만 얹힌다.
    expect(container.querySelector('img')).toBeInTheDocument()
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('should keep every mark decorative (aria-hidden) so it never becomes the accessible name', () => {
    // Arrange & Act
    const { container } = render(<UserAvatar nickname="모험가" provider="naver" size="sm" />)

    // Assert
    const wrapper = container.querySelector('[aria-hidden]')
    expect(wrapper).toBeInTheDocument()
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden')
  })
})
